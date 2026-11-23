import { Router } from 'express';
import { db, transaction } from '../db.js';
import { requireAdmin } from '../auth.js';
import { HttpError, str } from '../http.js';
import { fingerprint, validateRequestKey } from '../idempotency.js';
import { getSettings } from '../settings.js';
import { loadOrder } from '../orderView.js';
import { loadPricedLines, saveOrderItems } from '../orderItems.js';

const router = Router();
router.use(requireAdmin);
router.get('/', (_req, res) => res.json(db.prepare("SELECT id FROM orders WHERE channel = 'counter' ORDER BY id DESC LIMIT 30").all().map(({ id }) => loadOrder(id))));
router.get('/:id', (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isSafeInteger(id) || !db.prepare("SELECT 1 FROM orders WHERE id = ? AND channel = 'counter'").get(id)) throw new HttpError(404, 'Receipt not found.');
  res.json(loadOrder(id));
});
router.post('/', (req, res) => {
  const body = req.body ?? {};
  const key = req.get('Idempotency-Key');
  validateRequestKey(key);
  if (!key) throw new HttpError(400, 'A checkout retry key is required to record a counter sale.');
  const customerName = str(body.customerName ?? 'Walk-in customer', { field: 'Customer name', max: 100 });
  if (!Number.isSafeInteger(body.cashReceivedCents) || body.cashReceivedCents < 0 || !Number.isSafeInteger(body.expectedTotalCents) || body.expectedTotalCents < 0) throw new HttpError(400, 'Enter valid cash and total amounts in whole cents.');
  if (!Array.isArray(body.items) || !body.items.length || body.items.length > 50) throw new HttpError(400, 'Choose 1 to 50 sale items.');
  const wanted = new Map();
  for (const item of body.items) {
    if (!Number.isSafeInteger(item?.variantId) || item.variantId < 1 || !Number.isSafeInteger(item?.qty) || item.qty < 1 || !Number.isSafeInteger((wanted.get(item.variantId) ?? 0) + item.qty)) throw new HttpError(400, 'Variant IDs and quantities must be positive whole numbers.');
    wanted.set(item.variantId, (wanted.get(item.variantId) ?? 0) + item.qty);
  }
  const hash = fingerprint({ channel: 'counter', customerName, cashReceivedCents: body.cashReceivedCents, expectedTotalCents: body.expectedTotalCents, items: [...wanted].sort(([a], [b]) => a - b) });
  let replayed = false;
  const orderId = transaction(() => {
    const previous = db.prepare('SELECT * FROM checkout_requests WHERE user_id = ? AND request_key = ?').get(req.userId, key);
    if (previous) {
      if (previous.request_hash !== hash) throw new HttpError(409, 'This receipt key was already used for a different sale.');
      replayed = true;
      return previous.order_id;
    }
    const lines = loadPricedLines(wanted, getSettings().maxQtyPerItem);
    const total = lines.reduce((sum, { v, qty }) => sum + v.price_cents * qty, 0);
    if (total !== body.expectedTotalCents) throw new HttpError(409, 'Prices changed. Refresh the counter and confirm the total before recording payment.');
    if (body.cashReceivedCents < total) throw new HttpError(400, 'Cash received must cover the full sale total.');
    const result = db.prepare(`INSERT INTO orders (user_id, created_by, channel, fulfillment, payment_method, cash_received_cents,
      subtotal_cents, shipping_cents, total_cents, status, ship_name, ship_address, ship_city, ship_zip, completed_at)
      VALUES (?, ?, 'counter', 'counter', 'cash', ?, ?, 0, ?, 'delivered', ?, '', '', '', ?)`)
      .run(req.userId, req.userId, body.cashReceivedCents, total, total, customerName, new Date().toISOString());
    saveOrderItems(result.lastInsertRowid, lines);
    db.prepare('INSERT INTO checkout_requests (user_id, request_key, request_hash, order_id) VALUES (?, ?, ?, ?)').run(req.userId, key, hash, result.lastInsertRowid);
    return Number(result.lastInsertRowid);
  });
  res.status(replayed ? 200 : 201).json(loadOrder(orderId));
});
export default router;
