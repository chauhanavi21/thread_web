import assert from 'node:assert/strict';
import { after, before, beforeEach, test } from 'node:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';

const temporaryData = mkdtempSync(path.join(tmpdir(), 'threads-boutique-'));
process.env.THREADS_DATA_DIR = temporaryData;
process.env.JWT_SECRET = 'threads-boutique-tests-only';
const { db } = await import('../src/db.js');
const { app } = await import('../src/app.js');
const { signToken } = await import('../src/auth.js');
const { expirePickupReservations } = await import('../src/pickup.js');
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

const counterSale = (overrides = {}, options = {}) => request('/admin/counter-sales', {
  method: 'POST', userId: staff, key: randomUUID(),
  body: { items: [{ variantId: medium, qty: 1 }], cashReceivedCents: 3000, expectedTotalCents: 2500, ...overrides }, ...options,
});

test('a counter cash receipt consumes the same inventory and records change without shipping', async () => {
  const result = await counterSale();
  assert.equal(result.status, 201);
  assert.equal(result.data.channel, 'counter');
  assert.equal(result.data.fulfillment, 'counter');
  assert.equal(result.data.paymentMethod, 'cash');
  assert.equal(result.data.paymentStatus, 'paid');
  assert.equal(result.data.totalCents, 2500);
  assert.equal(result.data.shippingCents, 0);
  assert.equal(result.data.changeCents, 500);
  assert.equal(result.data.items[0].returnableQty, 1);
  assert.equal(result.data.canCancel, false);
  assert.equal(stock(medium), 4);
  const receipt = await request(`/admin/counter-sales/${result.data.id}`, { userId: staff });
  assert.equal(receipt.data.shipping.name, 'Walk-in customer');
  assert.deepEqual((await request('/orders', { userId: staff })).data, []);
  const users = (await request('/admin/users', { userId: staff })).data;
  assert.equal(users.find((user) => user.id === staff).spentCents, 0);
});

test('cash receipt retries return one receipt and preserve its original price snapshot', async () => {
  const key = randomUUID();
  const results = await Promise.all(Array.from({ length: 4 }, () => counterSale({}, { key })));
  assert.equal(results.filter((result) => result.status === 201).length, 1);
  assert.equal(results.filter((result) => result.status === 200).length, 3);
  assert.equal(new Set(results.map((result) => result.data.id)).size, 1);
  db.exec('UPDATE products SET price_cents = 9900');
  assert.equal((await counterSale({}, { key })).data.items[0].priceCents, 2500);
  assert.equal((await counterSale({ customerName: 'Different customer' }, { key })).status, 409);
  assert.equal(stock(medium), 4);
});

test('counter recording rejects stale prices, insufficient cash and invalid quantities without taking stock', async () => {
  assert.equal((await counterSale({ expectedTotalCents: 1 })).status, 409);
  assert.equal((await counterSale({ cashReceivedCents: 2499 })).status, 400);
  assert.equal((await counterSale({ items: [{ variantId: medium, qty: 1.5 }] })).status, 400);
  assert.equal((await counterSale({}, { key: undefined })).status, 400);
  assert.equal((await counterSale({ items: [{ variantId: medium, qty: 1 }, { variantId: large, qty: 4 }], expectedTotalCents: 12500, cashReceivedCents: 12500 })).status, 409);
  assert.equal(stock(medium), 5);
  assert.equal(stock(large), 3);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM orders').get().n, 0);
});

test('counter sales and receipts require staff access', async () => {
  assert.equal((await counterSale({}, { userId: customer })).status, 403);
  assert.equal((await request('/admin/counter-sales', { userId: customer })).status, 403);
  assert.equal((await request('/admin/counter-sales', { userId: null })).status, 401);
  const receipt = (await counterSale()).data;
  assert.equal((await request(`/orders/${receipt.id}`)).status, 404);
  assert.equal((await request(`/admin/counter-sales/${receipt.id}`, { userId: customer })).status, 403);
});

test('an online shopper and the counter cannot both buy the last unit', async () => {
  db.prepare('UPDATE variants SET stock = 1 WHERE id = ?').run(medium);
  const results = await Promise.all([
    counterSale(),
    request('/orders', { method: 'POST', body: { items: [{ variantId: medium, qty: 1 }], shipping } }),
  ]);
  assert.deepEqual(results.map((result) => result.status).sort(), [201, 409]);
  assert.equal(stock(medium), 0);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM orders').get().n, 1);
});

test('a counter purchase can be returned from its receipt through the shared inspection workflow', async () => {
  const order = (await counterSale()).data;
  const created = await request('/admin/returns', { method: 'POST', body: { orderId: order.id, ...returnBody(order) }, userId: staff });
  assert.equal(created.status, 201);
  await act(created.data.id, 'approve');
  await act(created.data.id, 'complete', inspect(created.data));
  assert.equal(stock(medium), 5);
  assert.equal((await request('/admin/stats', { userId: staff })).data.revenueCents, 0);
});

test('an inventory stream reports committed stock changes and can be closed', async () => {
  const controller = new AbortController();
  const response = await fetch(`${baseURL}/inventory/events`, { signal: controller.signal });
  assert.match(response.headers.get('content-type'), /text\/event-stream/);
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  const initial = decoder.decode((await reader.read()).value);
  assert.match(initial, /event: inventory/);
  const initialVersion = JSON.parse(initial.match(/data: (.+)/)[1]).version;
  await counterSale();
  const changed = decoder.decode((await reader.read()).value);
  assert.ok(JSON.parse(changed.match(/data: (.+)/)[1]).version > initialVersion);
  await reader.cancel();
  controller.abort();
});

const reservePickup = (overrides = {}, options = {}) => request('/orders', {
  method: 'POST', key: randomUUID(),
  body: { fulfillment: 'pickup', pickup: { name: 'Boutique Customer', contact: 'customer@example.test' }, items: [{ variantId: medium, qty: 2 }], ...overrides }, ...options,
});
const readyPickup = (id) => request(`/admin/orders/${id}`, { method: 'PATCH', body: { status: 'ready' }, userId: staff });
const collect = (id, cashReceivedCents = 6000, options = {}) => request(`/admin/pickups/${id}/collect`, { method: 'POST', body: { cashReceivedCents }, userId: staff, ...options });

test('pickup reserves shared stock with no shipping charge and remains unpaid until collection', async () => {
  const before = Date.now();
  const result = await reservePickup();
  assert.equal(result.status, 201);
  assert.equal(result.data.status, 'reserved');
  assert.equal(result.data.fulfillment, 'pickup');
  assert.equal(result.data.paymentStatus, 'unpaid');
  assert.equal(result.data.shippingCents, 0);
  assert.equal(result.data.totalCents, 5000);
  assert.equal(result.data.canCancel, true);
  assert.equal(result.data.items[0].returnableQty, 0);
  assert.ok(Date.parse(result.data.pickup.expiresAt) >= before + 24 * 3600000);
  assert.ok(Date.parse(result.data.pickup.expiresAt) <= Date.now() + 24 * 3600000);
  assert.equal(stock(medium), 3);
  assert.equal((await request('/admin/stats', { userId: staff })).data.revenueCents, 0);
  assert.equal((await request('/admin/users', { userId: staff })).data.find((user) => user.id === customer).spentCents, 0);
});

test('staff mark a pickup ready and record cash at collection without deducting stock twice', async () => {
  const order = (await reservePickup()).data;
  assert.equal((await collect(order.id)).status, 409);
  const ready = await readyPickup(order.id);
  assert.equal(ready.status, 200);
  assert.deepEqual(ready.data.allowedStatuses, ['ready', 'cancelled']);
  assert.equal((await collect(order.id, 4999)).status, 400);
  const collected = await collect(order.id);
  assert.equal(collected.status, 200);
  assert.equal(collected.data.status, 'collected');
  assert.equal(collected.data.paymentStatus, 'paid');
  assert.equal(collected.data.changeCents, 1000);
  assert.equal(collected.data.canCancel, false);
  assert.equal(collected.data.items[0].returnableQty, 2);
  assert.equal(stock(medium), 3);
  assert.equal((await request('/admin/stats', { userId: staff })).data.revenueCents, 5000);
});

test('collection retries preserve one receipt and a generic status update cannot skip cash recording', async () => {
  const order = (await reservePickup()).data;
  await readyPickup(order.id);
  assert.equal((await request(`/admin/orders/${order.id}`, { method: 'PATCH', body: { status: 'collected' }, userId: staff })).status, 409);
  assert.equal((await request(`/admin/orders/${order.id}`, { method: 'PATCH', body: { status: 'paid' }, userId: staff })).status, 409);
  const results = await Promise.all([collect(order.id), collect(order.id)]);
  assert.ok(results.every((result) => result.status === 200));
  assert.equal((await collect(order.id, 7000)).status, 409);
  assert.equal(stock(medium), 3);
  assert.equal((await request('/admin/stats', { userId: staff })).data.revenueCents, 5000);
});

test('pickup expiration releases a hold at the exact deadline once', async () => {
  const order = (await reservePickup()).data;
  const expires = Date.parse(order.pickup.expiresAt);
  assert.equal(expirePickupReservations(new Date(expires - 1)), 0);
  assert.equal(stock(medium), 3);
  assert.equal(expirePickupReservations(new Date(expires)), 1);
  assert.equal(expirePickupReservations(new Date(expires + 1)), 0);
  assert.equal(stock(medium), 5);
  const saved = (await request(`/orders/${order.id}`)).data;
  assert.equal(saved.status, 'expired');
  assert.equal(saved.paymentStatus, 'unpaid');
  assert.equal(saved.canCancel, false);
  assert.equal((await collect(order.id)).status, 409);
});

test('ordinary reads expire overdue holds before displaying or selling stock', async () => {
  const order = (await reservePickup()).data;
  db.prepare('UPDATE orders SET pickup_expires_at = ? WHERE id = ?').run('2000-01-01T00:00:00.000Z', order.id);
  const product = await request('/products/boutique-tee');
  assert.equal(product.data.variants.find((variant) => variant.id === medium).stock, 5);
  assert.equal((await request(`/orders/${order.id}`)).data.status, 'expired');
  assert.equal((await counterSale()).status, 201);
  assert.equal(stock(medium), 4);
});

test('cancelling reserved and ready pickups releases stock once and they cannot reopen as paid', async () => {
  for (const ready of [false, true]) {
    const order = (await reservePickup()).data;
    if (ready) await readyPickup(order.id);
    assert.equal((await request(`/orders/${order.id}/cancel`, { method: 'POST', userId: otherCustomer })).status, 404);
    assert.equal((await request(`/orders/${order.id}/cancel`, { method: 'POST' })).status, 200);
    assert.equal((await request(`/orders/${order.id}/cancel`, { method: 'POST' })).status, 200);
    assert.equal((await request(`/admin/orders/${order.id}`, { method: 'PATCH', body: { status: 'paid' }, userId: staff })).status, 409);
    assert.equal(stock(medium), 5);
  }
});

test('an expired pickup checkout retry returns the expired order without reserving stock again', async () => {
  const key = randomUUID();
  const order = (await reservePickup({}, { key })).data;
  expirePickupReservations(new Date(order.pickup.expiresAt));
  const replay = await reservePickup({}, { key });
  assert.equal(replay.status, 200);
  assert.equal(replay.data.id, order.id);
  assert.equal(replay.data.status, 'expired');
  assert.equal(stock(medium), 5);
});

test('pickup, online checkout and counter sales cannot reserve the same last unit', async () => {
  db.prepare('UPDATE variants SET stock = 1 WHERE id = ?').run(medium);
  const results = await Promise.all([
    reservePickup({ items: [{ variantId: medium, qty: 1 }] }),
    counterSale(),
    request('/orders', { method: 'POST', body: { items: [{ variantId: medium, qty: 1 }], shipping } }),
  ]);
  assert.deepEqual(results.map((result) => result.status).sort(), [201, 409, 409]);
  assert.equal(stock(medium), 0);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM orders').get().n, 1);
});

test('pickup settings are snapshotted and disabling new holds preserves existing collection', async () => {
  db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)').run('pickupAddress', JSON.stringify('Fictional boutique A'));
  db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)').run('pickupHoldHours', '1');
  const order = (await reservePickup()).data;
  assert.equal(order.pickup.location, 'Fictional boutique A');
  assert.equal((await request('/admin/settings', { method: 'PUT', body: { pickupEnabled: false, pickupHoldHours: 168, pickupAddress: 'Fictional boutique B' }, userId: staff })).status, 200);
  assert.equal((await reservePickup()).status, 409);
  const saved = (await request(`/orders/${order.id}`)).data;
  assert.equal(saved.pickup.location, 'Fictional boutique A');
  assert.equal(saved.pickup.expiresAt, order.pickup.expiresAt);
  await readyPickup(order.id);
  assert.equal((await collect(order.id)).status, 200);
});

test('collected pickups enter the same return and refund workflow', async () => {
  const order = (await reservePickup()).data;
  await readyPickup(order.id);
  await collect(order.id);
  const completed = (await request(`/orders/${order.id}`)).data;
  const returned = (await startReturn(completed, returnBody(completed, 'return', 2))).data;
  await act(returned.id, 'approve');
  await act(returned.id, 'complete', inspect(returned));
  assert.equal(stock(medium), 5);
  assert.equal((await request('/admin/stats', { userId: staff })).data.revenueCents, 0);
});

test('pickup contact data and staff collection are protected by ownership and role checks', async () => {
  const order = (await reservePickup()).data;
  assert.equal((await request(`/orders/${order.id}`, { userId: otherCustomer })).status, 404);
  assert.equal((await request('/admin/pickups')).status, 403);
  assert.equal((await collect(order.id, 6000, { userId: customer })).status, 403);
  assert.equal((await request('/admin/pickups', { userId: staff })).data[0].pickup.contact, 'customer@example.test');
  assert.equal((await reservePickup({ pickup: { name: 'Customer', contact: '' } })).status, 400);
});

test('a new server process recovers and expires persisted pickup deadlines', async () => {
  const order = (await reservePickup()).data;
  db.prepare('UPDATE orders SET pickup_expires_at = ? WHERE id = ?').run('2000-01-01T00:00:00.000Z', order.id);
  const recovered = spawnSync(process.execPath, ['--input-type=module', '-e', `
    import { expirePickupReservations } from './src/pickup.js';
    import { db } from './src/db.js';
    console.log(expirePickupReservations());
    db.close();
  `], { cwd: new URL('../', import.meta.url), env: process.env, encoding: 'utf8', timeout: 15000 });
  assert.equal(recovered.status, 0, recovered.stderr);
  assert.equal(recovered.stdout.trim(), '1');
  assert.equal(stock(medium), 5);
  assert.equal((await request(`/orders/${order.id}`)).data.status, 'expired');
});

test('removing staff access also prevents counter receipt and return access through customer routes', async () => {
  const order = (await counterSale()).data;
  const returnCase = (await request('/admin/returns', { method: 'POST', body: { orderId: order.id, ...returnBody(order) }, userId: staff })).data;
  const manager = Number(db.prepare("INSERT INTO users (name, email, password_hash, role) VALUES ('Manager', 'manager@example.test', 'unused', 'admin')").run().lastInsertRowid);
  assert.equal((await request(`/admin/users/${staff}`, { method: 'PATCH', body: { role: 'customer' }, userId: manager })).status, 200);
  assert.equal((await request(`/admin/counter-sales/${order.id}`, { userId: staff })).status, 403);
  assert.equal((await request(`/orders/${order.id}`, { userId: staff })).status, 404);
  assert.equal((await request(`/orders/${order.id}/returns`, { method: 'POST', body: returnBody(order), userId: staff })).status, 404);
  assert.equal((await request(`/returns/${returnCase.id}/cancel`, { method: 'POST', userId: staff })).status, 404);
});
