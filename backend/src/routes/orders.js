import { Router } from 'express';
import { db, transaction } from '../db.js';
import { requireAuth } from '../auth.js';
import { HttpError, str } from '../http.js';

const router = Router();
router.use(requireAuth);

const FREE_SHIPPING_OVER_CENTS = 10000;
const FLAT_SHIPPING_CENTS = 699;
const MAX_QTY_PER_ITEM = 10;

function loadOrder(orderId) {
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
  const items = db
    .prepare('SELECT oi.*, p.slug, p.type FROM order_items oi JOIN products p ON p.id = oi.product_id WHERE oi.order_id = ? ORDER BY oi.id')
    .all(orderId);
  return {
    id: order.id,
    status: order.status,
    createdAt: order.created_at,
    subtotalCents: order.subtotal_cents,
    shippingCents: order.shipping_cents,
    totalCents: order.total_cents,
    shipping: { name: order.ship_name, address: order.ship_address, city: order.ship_city, zip: order.ship_zip },
    items: items.map((i) => ({
      productId: i.product_id,
      variantId: i.variant_id,
      slug: i.slug,
      type: i.type,
      name: i.name,
      color: i.color,
      colorHex: i.color_hex,
      size: i.size,
      priceCents: i.price_cents,
      qty: i.qty,
    })),
  };
}

router.get('/', (req, res) => {
  const ids = db.prepare('SELECT id FROM orders WHERE user_id = ? ORDER BY id DESC').all(req.userId);
  res.json(ids.map(({ id }) => loadOrder(id)));
});

router.get('/:id', (req, res) => {
  const row = db.prepare('SELECT id FROM orders WHERE id = ? AND user_id = ?').get(Number(req.params.id), req.userId);
  if (!row) throw new HttpError(404, 'Order not found.');
  res.json(loadOrder(row.id));
});

// POST /api/orders   { items: [{ variantId, qty }], shipping: { name, address, city, zip } }
// Prices are always read from the database, never trusted from the client.
// Payment is a local stand-in: any order that passes validation is marked "paid".
router.post('/', (req, res) => {
  const body = req.body ?? {};
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
    if (!Number.isInteger(variantId) || !Number.isInteger(qty) || qty < 1 || qty > MAX_QTY_PER_ITEM) {
      throw new HttpError(400, `Quantity must be a whole number from 1 to ${MAX_QTY_PER_ITEM}.`);
    }
    wanted.set(variantId, (wanted.get(variantId) ?? 0) + qty);
  }

  const orderId = transaction(() => {
    const getVariant = db.prepare(
      'SELECT v.*, p.name AS product_name, p.price_cents FROM variants v JOIN products p ON p.id = v.product_id WHERE v.id = ?',
    );
    const lines = [];
    for (const [variantId, qty] of wanted) {
      const v = getVariant.get(variantId);
      if (!v) throw new HttpError(400, 'One of the items in your bag is no longer available.');
      const label = `${v.product_name} (${v.color}, ${v.size})`;
      if (qty > MAX_QTY_PER_ITEM) throw new HttpError(400, `You can order at most ${MAX_QTY_PER_ITEM} of "${label}".`);
      if (v.stock < qty) {
        throw new HttpError(409, v.stock === 0 ? `"${label}" is out of stock.` : `Only ${v.stock} of "${label}" left in stock.`);
      }
      lines.push({ v, qty });
    }

    const subtotal = lines.reduce((sum, { v, qty }) => sum + v.price_cents * qty, 0);
    const shippingCents = subtotal >= FREE_SHIPPING_OVER_CENTS ? 0 : FLAT_SHIPPING_CENTS;

    const { lastInsertRowid } = db
      .prepare(
        `INSERT INTO orders (user_id, subtotal_cents, shipping_cents, total_cents, ship_name, ship_address, ship_city, ship_zip)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(req.userId, subtotal, shippingCents, subtotal + shippingCents, shipping.name, shipping.address, shipping.city, shipping.zip);

    const insertItem = db.prepare(
      `INSERT INTO order_items (order_id, product_id, variant_id, name, color, color_hex, size, price_cents, qty)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    const decrement = db.prepare('UPDATE variants SET stock = stock - ? WHERE id = ?');
    for (const { v, qty } of lines) {
      insertItem.run(lastInsertRowid, v.product_id, v.id, v.product_name, v.color, v.color_hex, v.size, v.price_cents, qty);
      decrement.run(qty, v.id);
    }
    return Number(lastInsertRowid);
  });

  res.status(201).json(loadOrder(orderId));
});

export default router;
