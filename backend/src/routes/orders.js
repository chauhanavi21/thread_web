import { Router } from 'express';
import { db, transaction } from '../db.js';
import { requireAuth } from '../auth.js';
import { HttpError, str } from '../http.js';
import { getSettings } from '../settings.js';
import { changeOrderStatus } from '../orderStatus.js';
import { fingerprint, validateRequestKey } from '../idempotency.js';
import { createReturnCase } from '../returns.js';
import { loadOrder } from '../orderView.js';
import { loadPricedLines, saveOrderItems } from '../orderItems.js';

const router = Router();
router.use(requireAuth);


router.get('/', (req, res) => {
  const ids = db.prepare("SELECT id FROM orders WHERE user_id = ? AND channel = 'online' ORDER BY id DESC").all(req.userId);
  res.json(ids.map(({ id }) => loadOrder(id)));
});

router.get('/:id', (req, res) => {
  const row = db.prepare('SELECT id FROM orders WHERE id = ? AND user_id = ?').get(Number(req.params.id), req.userId);
  if (!row) throw new HttpError(404, 'Order not found.');
  res.json(loadOrder(row.id));
});

router.post('/:id/cancel', (req, res) => {
  const orderId = Number(req.params.id);
  changeOrderStatus(orderId, 'cancelled', req.userId);
  res.json(loadOrder(orderId));
});

router.post('/:id/returns', (req, res) => {
  const result = createReturnCase(Number(req.params.id), req.userId, req.body, { requestKey: req.get('Idempotency-Key') });
  res.status(result.replayed ? 200 : 201).json(result.returnCase);
});

// POST /api/orders   { items: [{ variantId, qty }], shipping: { name, address, city, zip } }
// Prices are always read from the database, never trusted from the client.
// Payment is a local stand-in: any order that passes validation is marked "paid".
router.post('/', (req, res) => {
  const body = req.body ?? {};
  const requestKey = req.get('Idempotency-Key');
  validateRequestKey(requestKey);
  const shipping = {
    name: str(body.shipping?.name, { field: 'Full name', max: 100 }),
    address: str(body.shipping?.address, { field: 'Address', max: 200 }),
    city: str(body.shipping?.city, { field: 'City', max: 100 }),
    zip: str(body.shipping?.zip, { field: 'ZIP / postal code', min: 3, max: 12 }),
  };

  if (!Array.isArray(body.items) || body.items.length === 0) throw new HttpError(400, 'Your bag is empty.');
  if (body.items.length > 50) throw new HttpError(400, 'Too many different items in one order.');

  // Merge duplicate variant ids and validate quantities.
  const wanted = new Map();
  for (const item of body.items) {
    const variantId = Number(item?.variantId);
    const qty = Number(item?.qty);
    if (!Number.isSafeInteger(variantId) || variantId < 1 || !Number.isSafeInteger(qty) || qty < 1 || !Number.isSafeInteger((wanted.get(variantId) ?? 0) + qty)) {
      throw new HttpError(400, 'Variant IDs and quantities must be positive whole numbers.');
    }
    wanted.set(variantId, (wanted.get(variantId) ?? 0) + qty);
  }

  const requestHash = fingerprint({
    shipping,
    items: [...wanted].sort(([a], [b]) => a - b),
  });
  let replayed = false;

  const orderId = transaction(() => {
    if (requestKey) {
      const previous = db.prepare('SELECT request_hash, order_id FROM checkout_requests WHERE user_id = ? AND request_key = ?').get(req.userId, requestKey);
      if (previous) {
        if (previous.request_hash !== requestHash) throw new HttpError(409, 'This checkout was already used for a different bag or address. Review your orders before trying again.');
        replayed = true;
        return previous.order_id;
      }
    }
    const { freeShippingOverCents, flatShippingCents, maxQtyPerItem: MAX_QTY_PER_ITEM } = getSettings();
    const lines = loadPricedLines(wanted, MAX_QTY_PER_ITEM);

    const subtotal = lines.reduce((sum, { v, qty }) => sum + v.price_cents * qty, 0);
    const shippingCents = subtotal >= freeShippingOverCents ? 0 : flatShippingCents;

    const { lastInsertRowid } = db
      .prepare(
        `INSERT INTO orders (user_id, subtotal_cents, shipping_cents, total_cents, ship_name, ship_address, ship_city, ship_zip)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(req.userId, subtotal, shippingCents, subtotal + shippingCents, shipping.name, shipping.address, shipping.city, shipping.zip);

    saveOrderItems(lastInsertRowid, lines);

    if (requestKey) {
      db.prepare('INSERT INTO checkout_requests (user_id, request_key, request_hash, order_id) VALUES (?, ?, ?, ?)')
        .run(req.userId, requestKey, requestHash, lastInsertRowid);
    }
    return Number(lastInsertRowid);
  });

  if (replayed) res.set('Idempotency-Replayed', 'true');
  res.status(replayed ? 200 : 201).json(loadOrder(orderId));
});

export default router;
