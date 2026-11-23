import assert from 'node:assert/strict';
import { after, before, beforeEach, test } from 'node:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const temporaryData = mkdtempSync(path.join(tmpdir(), 'threads-api-'));
process.env.THREADS_DATA_DIR = temporaryData;
process.env.JWT_SECRET = 'threads-integration-tests-only';
const { db } = await import('../src/db.js');
const { app } = await import('../src/app.js');
const { signToken } = await import('../src/auth.js');

let server;
let baseURL;
let customer;
let otherCustomer;
let administrator;
let variantId;
let secondVariantId;
const shipping = { name: 'Demo Customer', address: '12 Example Street', city: 'Sample City', zip: '12345' };
const key = 'checkout-request-0001';

before(async () => {
  server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  baseURL = `http://127.0.0.1:${server.address().port}/api`;
});

after(async () => {
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  db.close();
  assert.ok(path.resolve(temporaryData).startsWith(path.join(path.resolve(tmpdir()), 'threads-api-')));
  rmSync(temporaryData, { recursive: true, force: true });
});

beforeEach(() => {
  db.exec('DELETE FROM orders; DELETE FROM products; DELETE FROM users; DELETE FROM settings;');
  const user = db.prepare('INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)');
  customer = Number(user.run('Demo Customer', 'customer@example.test', 'unused', 'customer').lastInsertRowid);
  otherCustomer = Number(user.run('Other Customer', 'other@example.test', 'unused', 'customer').lastInsertRowid);
  administrator = Number(user.run('Administrator', 'admin@example.test', 'unused', 'admin').lastInsertRowid);
  const productId = db.prepare("INSERT INTO products (slug, name, category, type, description, price_cents) VALUES ('test-tee', 'Test Tee', 'men', 't-shirts', 'A fictional test product.', 2500)").run().lastInsertRowid;
  const variant = db.prepare('INSERT INTO variants (product_id, color, color_hex, size, stock) VALUES (?, ?, ?, ?, ?)');
  variantId = Number(variant.run(productId, 'Cream', '#eeeeee', 'M', 5).lastInsertRowid);
  secondVariantId = Number(variant.run(productId, 'Ink', '#111111', 'L', 3).lastInsertRowid);
});

async function request(route, { method = 'GET', body, userId = customer, requestKey } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (userId) headers.Authorization = `Bearer ${signToken({ id: userId })}`;
  if (requestKey !== undefined) headers['Idempotency-Key'] = requestKey;
  const response = await fetch(`${baseURL}${route}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  return { status: response.status, data: await response.json(), replayed: response.headers.get('Idempotency-Replayed') };
}

const bag = (qty = 1) => ({ items: [{ variantId, qty }], shipping });
const place = (body = bag(), options = {}) => request('/orders', { method: 'POST', body, ...options });
const stock = (id = variantId) => db.prepare('SELECT stock FROM variants WHERE id = ?').get(id).stock;
const orderCount = () => db.prepare('SELECT COUNT(*) AS count FROM orders').get().count;

test('checkout uses server prices and shipping, and saves item snapshots', async () => {
  const result = await place({ ...bag(2), totalCents: 1, items: [{ variantId, qty: 2, priceCents: 1 }] });
  assert.equal(result.status, 201);
  assert.equal(result.data.subtotalCents, 5000);
  assert.equal(result.data.shippingCents, 699);
  assert.equal(result.data.totalCents, 5699);
  assert.equal(stock(), 3);
  db.exec("UPDATE products SET name = 'Renamed Tee', price_cents = 9000");
  const saved = await request(`/orders/${result.data.id}`);
  assert.equal(saved.data.items[0].name, 'Test Tee');
  assert.equal(saved.data.items[0].priceCents, 2500);
});

test('shipping and merged quantity limits follow administrator settings', async () => {
  db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)').run('maxQtyPerItem', '2');
  db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)').run('freeShippingOverCents', '2500');
  assert.equal((await place(bag(2))).data.shippingCents, 0);
  const result = await place({ items: [{ variantId, qty: 2 }, { variantId, qty: 1 }], shipping });
  assert.equal(result.status, 400);
  assert.equal(stock(), 3);
  assert.equal(orderCount(), 1);
});

test('a rejected multi-line checkout leaves every stock count unchanged', async () => {
  const result = await place({ items: [{ variantId, qty: 2 }, { variantId: secondVariantId, qty: 4 }], shipping });
  assert.equal(result.status, 409);
  assert.equal(stock(), 5);
  assert.equal(stock(secondVariantId), 3);
  assert.equal(orderCount(), 0);
});

test('competing checkouts cannot both buy the last item', async () => {
  db.prepare('UPDATE variants SET stock = 1 WHERE id = ?').run(variantId);
  const results = await Promise.all([place(), place(bag(), { userId: otherCustomer })]);
  assert.deepEqual(results.map((result) => result.status).sort(), [201, 409]);
  assert.equal(stock(), 0);
  assert.equal(orderCount(), 1);
});

test('replaying a checkout returns the original order and only decrements stock once', async () => {
  const first = await place(bag(5), { requestKey: key });
  const retry = await place(bag(5), { requestKey: key });
  assert.equal(first.status, 201);
  assert.equal(retry.status, 200);
  assert.equal(retry.replayed, 'true');
  assert.deepEqual(retry.data, first.data);
  assert.equal(stock(), 0);
  assert.equal(orderCount(), 1);
});

test('concurrent retries share one order', async () => {
  const results = await Promise.all(Array.from({ length: 6 }, () => place(bag(2), { requestKey: key })));
  assert.equal(results.filter((result) => result.status === 201).length, 1);
  assert.equal(results.filter((result) => result.status === 200).length, 5);
  assert.equal(new Set(results.map((result) => result.data.id)).size, 1);
  assert.equal(stock(), 3);
});

test('the retry receipt survives a new server process', async () => {
  const first = await place(bag(5), { requestKey: key });
  const replay = spawnSync(process.execPath, ['--input-type=module', '-e', `
    import { app } from './src/app.js';
    import { db } from './src/db.js';
    const server = app.listen(0, '127.0.0.1');
    await new Promise((resolve) => server.once('listening', resolve));
    const response = await fetch('http://127.0.0.1:' + server.address().port + '/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: process.env.TEST_AUTH, 'Idempotency-Key': '${key}' },
      body: process.env.TEST_BODY,
    });
    console.log(JSON.stringify({ status: response.status, order: await response.json() }));
    await new Promise((resolve) => server.close(resolve));
    db.close();
  `], { cwd: new URL('../', import.meta.url), env: { ...process.env, TEST_AUTH: `Bearer ${signToken({ id: customer })}`, TEST_BODY: JSON.stringify(bag(5)) }, encoding: 'utf8', timeout: 15000 });
  assert.equal(replay.status, 0, replay.stderr);
  const result = JSON.parse(replay.stdout);
  assert.equal(result.status, 200);
  assert.equal(result.order.id, first.data.id);
  assert.equal(stock(), 0);
});

test('a retry still succeeds after the shop changes its quantity rules', async () => {
  const first = await place(bag(3), { requestKey: key });
  db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)').run('maxQtyPerItem', '1');
  const result = await place(bag(3), { requestKey: key });
  assert.equal(result.status, 200);
  assert.equal(result.data.id, first.data.id);
  assert.equal(stock(), 2);
});

test('equivalent merged items and trimmed addresses replay the same checkout', async () => {
  const first = await place({ items: [{ variantId, qty: 2 }, { variantId: secondVariantId, qty: 1 }], shipping }, { requestKey: key });
  const retry = await place({ items: [{ variantId: secondVariantId, qty: 1 }, { variantId, qty: 1 }, { variantId, qty: 1 }], shipping: { ...shipping, name: ` ${shipping.name} ` } }, { requestKey: key });
  assert.equal(retry.status, 200);
  assert.equal(retry.data.id, first.data.id);
  assert.equal(stock(), 3);
});

test('reusing a key for a changed bag or address fails without creating another order', async () => {
  await place(bag(), { requestKey: key });
  assert.equal((await place(bag(2), { requestKey: key })).status, 409);
  assert.equal((await place({ ...bag(), shipping: { ...shipping, city: 'Another City' } }, { requestKey: key })).status, 409);
  assert.equal(orderCount(), 1);
  assert.equal(stock(), 4);
});

test('retry keys belong to individual customers', async () => {
  const first = await place(bag(), { requestKey: key });
  const second = await place(bag(), { requestKey: key, userId: otherCustomer });
  assert.equal(second.status, 201);
  assert.notEqual(first.data.id, second.data.id);
  assert.equal((await request(`/orders/${first.data.id}`, { userId: otherCustomer })).status, 404);
  assert.equal(stock(), 3);
});

test('a rejected checkout does not consume its retry key', async () => {
  assert.equal((await place(bag(6), { requestKey: key })).status, 409);
  db.prepare('UPDATE variants SET stock = 6 WHERE id = ?').run(variantId);
  assert.equal((await place(bag(6), { requestKey: key })).status, 201);
  assert.equal(stock(), 0);
});

test('invalid keys, missing authentication and malformed quantities leave stock alone', async () => {
  assert.equal((await place(bag(), { requestKey: 'short' })).status, 400);
  assert.equal((await place(bag(), { requestKey: 'a'.repeat(129) })).status, 400);
  assert.equal((await place(bag(), { userId: null })).status, 401);
  for (const qty of [0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1]) {
    assert.equal((await place(bag(qty))).status, 400);
  }
  assert.equal((await place({ ...bag(), items: [{ variantId: 0, qty: 1 }] })).status, 400);
  assert.equal(orderCount(), 0);
  assert.equal(stock(), 5);
});

test('hidden products cannot be bought and existing clients can omit retry keys', async () => {
  db.exec('UPDATE products SET active = 0');
  assert.equal((await place()).status, 400);
  assert.equal(stock(), 5);
  db.exec('UPDATE products SET active = 1');
  assert.equal((await place()).status, 201);
  assert.equal((await place()).status, 201);
  assert.equal(orderCount(), 2);
});
