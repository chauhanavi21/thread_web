import assert from 'node:assert/strict';
import { after, before, beforeEach, test } from 'node:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const temporaryData = mkdtempSync(path.join(tmpdir(), 'threads-boutique-'));
process.env.THREADS_DATA_DIR = temporaryData;
process.env.JWT_SECRET = 'threads-boutique-tests-only';
const { db } = await import('../src/db.js');
const { app } = await import('../src/app.js');
const { signToken } = await import('../src/auth.js');
let server, baseURL, customer, otherCustomer, staff, productId, medium, large;
const shipping = { name: 'Boutique Customer', address: '12 Example Street', city: 'Sample City', zip: '12345' };

before(async () => {
  server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  baseURL = `http://127.0.0.1:${server.address().port}/api`;
});
after(async () => {
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  db.close();
  assert.ok(path.resolve(temporaryData).startsWith(path.join(path.resolve(tmpdir()), 'threads-boutique-')));
  rmSync(temporaryData, { recursive: true, force: true });
});
beforeEach(() => {
  db.exec('DELETE FROM orders; DELETE FROM products; DELETE FROM users; DELETE FROM settings;');
  const user = db.prepare('INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)');
  customer = Number(user.run('Boutique Customer', 'customer@example.test', 'unused', 'customer').lastInsertRowid);
  otherCustomer = Number(user.run('Other Customer', 'other@example.test', 'unused', 'customer').lastInsertRowid);
  staff = Number(user.run('Shop Staff', 'staff@example.test', 'unused', 'admin').lastInsertRowid);
  db.exec("INSERT OR IGNORE INTO categories (key, title) VALUES ('men', 'Men')");
  productId = Number(db.prepare("INSERT INTO products (slug, name, category, type, description, price_cents) VALUES ('boutique-tee', 'Boutique Tee', 'men', 't-shirts', 'Fictional test product.', 2500)").run().lastInsertRowid);
  const variant = db.prepare('INSERT INTO variants (product_id, color, color_hex, size, stock) VALUES (?, ?, ?, ?, ?)');
  medium = Number(variant.run(productId, 'Ink', '#111111', 'M', 5).lastInsertRowid);
  large = Number(variant.run(productId, 'Ink', '#111111', 'L', 3).lastInsertRowid);
});

async function request(route, { method = 'GET', body, userId = customer, key } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (userId) headers.Authorization = `Bearer ${signToken({ id: userId })}`;
  if (key !== undefined) headers['Idempotency-Key'] = key;
  const response = await fetch(`${baseURL}${route}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  return { status: response.status, data: await response.json() };
}
const stock = (variantId) => db.prepare('SELECT stock FROM variants WHERE id = ?').get(variantId).stock;
const act = (id, action, body = {}) => request(`/admin/returns/${id}/actions`, { method: 'POST', body: { action, ...body }, userId: staff });
async function purchase(items = [{ variantId: medium, qty: 1 }], completed = true) {
  const result = await request('/orders', { method: 'POST', body: { items, shipping } });
  assert.equal(result.status, 201, JSON.stringify(result.data));
  if (completed) {
    for (const status of ['processing', 'shipped', 'delivered']) {
      assert.equal((await request(`/admin/orders/${result.data.id}`, { method: 'PATCH', body: { status }, userId: staff })).status, 200);
    }
  }
  return (await request(`/orders/${result.data.id}`)).data;
}
const returnBody = (order, kind = 'return', qty = 1) => ({
  kind, reason: 'Size does not fit', items: [{ orderItemId: order.items[0].id, qty, ...(kind === 'exchange' ? { replacementVariantId: large } : {}) }],
});
const startReturn = (order, body = returnBody(order), options = {}) => request(`/orders/${order.id}/returns`, { method: 'POST', body, ...options });
const inspect = (returnCase, restock = true) => ({ inspections: returnCase.items.map((item) => ({ itemId: item.id, restock })), confirmRefund: true });

test('a size exchange reserves the replacement on approval and restocks the inspected original once', async () => {
  const order = await purchase();
  const created = await startReturn(order, returnBody(order, 'exchange'));
  assert.equal(created.status, 201);
  assert.equal(stock(large), 3);
  assert.equal((await act(created.data.id, 'approve')).status, 200);
  assert.equal((await act(created.data.id, 'approve')).status, 200);
  assert.equal(stock(large), 2);
  assert.equal(stock(medium), 4);
  assert.equal((await act(created.data.id, 'complete', inspect(created.data))).status, 200);
  assert.equal((await act(created.data.id, 'complete', inspect(created.data))).status, 200);
  assert.equal(stock(medium), 5);
  assert.equal(stock(large), 2);
  const updated = (await request(`/orders/${order.id}`)).data;
  assert.equal(updated.items[0].returnableQty, 0);
  assert.equal(updated.returnCases[0].status, 'completed');
  assert.equal(updated.returnCases[0].refundCents, 0);
});

test('damaged returns stay out of sellable stock and require an explicit refund record', async () => {
  const order = await purchase();
  const created = (await startReturn(order)).data;
  await act(created.id, 'approve');
  assert.equal((await act(created.id, 'complete', { ...inspect(created, false), confirmRefund: false })).status, 400);
  assert.equal((await act(created.id, 'complete', inspect(created, false))).status, 200);
  assert.equal(stock(medium), 4);
  assert.equal((await act(created.id, 'reject')).status, 409);
});

test('partial returns refund original prices and prevent overlapping quantities', async () => {
  const order = await purchase([{ variantId: medium, qty: 2 }]);
  db.exec('UPDATE products SET price_cents = 9900');
  const created = await startReturn(order);
  assert.equal(created.data.refundCents, 2500);
  assert.equal((await startReturn(order, returnBody(order, 'return', 2))).status, 409);
  await act(created.data.id, 'approve');
  await act(created.data.id, 'complete', inspect(created.data));
  assert.equal((await request(`/orders/${order.id}`)).data.items[0].returnableQty, 1);
  const next = await startReturn(order);
  assert.equal(next.status, 201);
  assert.equal((await startReturn(order)).status, 409);
});

test('return creation retries share a request and changed contents conflict', async () => {
  const order = await purchase([{ variantId: medium, qty: 2 }]);
  const key = 'return-request-retry-001';
  const results = await Promise.all(Array.from({ length: 4 }, () => startReturn(order, returnBody(order), { key })));
  assert.equal(results.filter((result) => result.status === 201).length, 1);
  assert.equal(results.filter((result) => result.status === 200).length, 3);
  assert.equal(new Set(results.map((result) => result.data.id)).size, 1);
  assert.equal((await startReturn(order, returnBody(order, 'return', 2), { key })).status, 409);
});

test('customers can only request or withdraw their own returns and cannot approve them', async () => {
  const order = await purchase();
  assert.equal((await startReturn(order, returnBody(order), { userId: otherCustomer })).status, 404);
  const created = (await startReturn(order)).data;
  assert.equal((await request(`/returns/${created.id}/cancel`, { method: 'POST', userId: otherCustomer })).status, 404);
  assert.equal((await request(`/admin/returns/${created.id}/actions`, { method: 'POST', body: { action: 'approve' } })).status, 403);
  assert.equal((await request('/admin/returns', { userId: null })).status, 401);
  assert.equal(stock(medium), 4);
});

test('returns require a completed order inside the configured window', async () => {
  const order = await purchase(undefined, false);
  assert.equal((await startReturn(order)).status, 409);
  for (const status of ['processing', 'shipped', 'delivered']) await request(`/admin/orders/${order.id}`, { method: 'PATCH', body: { status }, userId: staff });
  db.prepare('UPDATE orders SET completed_at = ? WHERE id = ?').run('2000-01-01T00:00:00.000Z', order.id);
  assert.equal((await startReturn(order)).status, 409);
  assert.equal((await request(`/orders/${order.id}`)).data.items[0].returnableQty, 0);
});

test('rejection or withdrawal releases held replacement stock once and frees the purchased quantity', async () => {
  const order = await purchase();
  const first = (await startReturn(order, returnBody(order, 'exchange'))).data;
  await act(first.id, 'approve');
  assert.equal(stock(large), 2);
  assert.equal((await request(`/returns/${first.id}/cancel`, { method: 'POST' })).status, 200);
  assert.equal((await request(`/returns/${first.id}/cancel`, { method: 'POST' })).status, 200);
  assert.equal(stock(large), 3);
  const next = (await startReturn(order, returnBody(order, 'exchange'))).data;
  await act(next.id, 'approve');
  await act(next.id, 'reject');
  await act(next.id, 'reject');
  assert.equal(stock(large), 3);
  assert.equal((await request(`/orders/${order.id}`)).data.items[0].returnableQty, 1);
});

test('a failed multi-line exchange approval rolls back every replacement reservation', async () => {
  const order = await purchase([{ variantId: medium, qty: 1 }, { variantId: large, qty: 1 }]);
  const created = await startReturn(order, { kind: 'exchange', reason: 'Swap sizes', items: [
    { orderItemId: order.items[0].id, qty: 1, replacementVariantId: large },
    { orderItemId: order.items[1].id, qty: 1, replacementVariantId: medium },
  ] });
  db.prepare('UPDATE variants SET stock = 0 WHERE id = ?').run(medium);
  assert.equal((await act(created.data.id, 'approve')).status, 409);
  assert.equal(stock(large), 2);
  assert.equal((await request('/admin/returns', { userId: staff })).data[0].status, 'requested');
});

test('invalid later inspections roll back earlier restocks and preserve the approved case', async () => {
  const order = await purchase([{ variantId: medium, qty: 1 }, { variantId: large, qty: 1 }]);
  const created = (await startReturn(order, { kind: 'return', reason: 'Return both', items: order.items.map((item) => ({ orderItemId: item.id, qty: 1 })) })).data;
  await act(created.id, 'approve');
  const payload = inspect(created);
  payload.inspections[1].restock = 'yes';
  assert.equal((await act(created.id, 'complete', payload)).status, 400);
  assert.equal(stock(medium), 4);
  assert.equal(stock(large), 2);
  assert.equal((await request('/admin/returns', { userId: staff })).data[0].status, 'approved');
});

test('staff can open a return from a receipt and completed refunds reduce net revenue', async () => {
  const order = await purchase();
  const before = (await request('/admin/stats', { userId: staff })).data.revenueCents;
  const created = await request('/admin/returns', { method: 'POST', body: { orderId: order.id, ...returnBody(order) }, userId: staff });
  assert.equal(created.status, 201);
  assert.equal((await request('/admin/stats', { userId: staff })).data.revenueCents, before);
  await act(created.data.id, 'approve');
  await act(created.data.id, 'complete', inspect(created.data));
  const stats = (await request('/admin/stats', { userId: staff })).data;
  assert.equal(stats.revenueCents, before - 2500);
  assert.equal(stats.topProducts[0].sold, 0);
  const users = (await request('/admin/users', { userId: staff })).data;
  assert.equal(users.find((user) => user.id === customer).spentCents, before - 2500);
});

test('exchanges reject other products, the original variant, foreign lines and invalid quantities', async () => {
  const order = await purchase();
  const body = returnBody(order, 'exchange');
  assert.equal((await startReturn(order, { ...body, items: [{ ...body.items[0], replacementVariantId: medium }] })).status, 400);
  assert.equal((await startReturn(order, { ...body, items: [{ ...body.items[0], orderItemId: 999999 }] })).status, 400);
  for (const qty of [0, -1, 1.5, '1']) assert.equal((await startReturn(order, returnBody(order, 'return', qty))).status, 400);
  const other = Number(db.prepare("INSERT INTO products (slug, name, category, type, description, price_cents) VALUES ('other', 'Other', 'men', 'jeans', 'Another test product', 1000)").run().lastInsertRowid);
  const variant = Number(db.prepare("INSERT INTO variants (product_id, color, color_hex, size, stock) VALUES (?, 'Ink', '#111111', 'M', 2)").run(other).lastInsertRowid);
  assert.equal((await startReturn(order, { ...body, items: [{ ...body.items[0], replacementVariantId: variant }] })).status, 400);
});
