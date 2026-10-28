import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import express, { Router } from 'express';
import { db, dataDir, transaction } from '../db.js';
import { requireAdmin } from '../auth.js';
import { HttpError, str } from '../http.js';
import { getSettings, updateSettings } from '../settings.js';
import { listProducts, toProducts } from './products.js';

export const UPLOAD_DIR = path.join(dataDir, 'uploads');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

export const ORDER_STATUSES = ['paid', 'processing', 'shipped', 'delivered', 'cancelled'];

const router = Router();
router.use(requireAdmin);

const int = (value, field, { min = 0, max = 100_000_000 } = {}) => {
  const n = Number(value);
  if (!Number.isInteger(n) || n < min || n > max) throw new HttpError(400, `${field} must be a whole number from ${min} to ${max}.`);
  return n;
};
const id = (req) => int(req.params.id, 'id', { min: 1, max: Number.MAX_SAFE_INTEGER });
const slugify = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80);
const HEX_RE = /^#[0-9a-fA-F]{6}$/;

// ---------------------------------------------------------------- dashboard

router.get('/stats', (_req, res) => {
  const one = (sql) => db.prepare(sql).get();
  const live = "status != 'cancelled'";
  res.json({
    products: one('SELECT COUNT(*) AS n FROM products').n,
    activeProducts: one('SELECT COUNT(*) AS n FROM products WHERE active = 1').n,
    customers: one("SELECT COUNT(*) AS n FROM users WHERE role = 'customer'").n,
    orders: one('SELECT COUNT(*) AS n FROM orders').n,
    revenueCents: one(`SELECT COALESCE(SUM(total_cents), 0) AS n FROM orders WHERE ${live}`).n,
    toFulfil: one("SELECT COUNT(*) AS n FROM orders WHERE status IN ('paid', 'processing')").n,
    lowStock: db
      .prepare(
        `SELECT p.id AS productId, p.name, v.id AS variantId, v.color, v.size, v.stock
         FROM variants v JOIN products p ON p.id = v.product_id
         WHERE p.active = 1 AND v.stock <= 3 ORDER BY v.stock, p.name LIMIT 12`,
      )
      .all(),
    recentOrders: db
      .prepare('SELECT o.id, o.total_cents AS totalCents, o.status, o.created_at AS createdAt, u.name AS customer FROM orders o JOIN users u ON u.id = o.user_id ORDER BY o.id DESC LIMIT 6')
      .all(),
    topProducts: db
      .prepare(
        `SELECT oi.product_id AS productId, oi.name, SUM(oi.qty) AS sold
         FROM order_items oi JOIN orders o ON o.id = oi.order_id WHERE o.${live}
         GROUP BY oi.product_id ORDER BY sold DESC LIMIT 5`,
      )
      .all(),
  });
});

// ---------------------------------------------------------------- products

/** Validates the editable product fields. `partial` is not supported on purpose: the form always sends everything. */
function productFields(body) {
  const category = str(body.category, { field: 'Category', max: 40 });
  if (!db.prepare('SELECT 1 FROM categories WHERE key = ?').get(category)) throw new HttpError(400, `Unknown category "${category}".`);
  const rating = Number(body.rating ?? 4.5);
  if (!(rating >= 0 && rating <= 5)) throw new HttpError(400, 'Rating must be between 0 and 5.');
  let image = body.image ?? null;
  if (image !== null) {
    image = str(image, { field: 'Image', max: 500 });
    if (!/^(\/images\/|\/api\/uploads\/|https:\/\/)/.test(image)) throw new HttpError(400, 'Image must be an uploaded file or an https:// link.');
  }
  return {
    name: str(body.name, { field: 'Name', max: 120 }),
    category,
    type: slugify(str(body.type, { field: 'Type', max: 40 })) || (() => { throw new HttpError(400, 'Type is required.'); })(),
    description: str(body.description, { field: 'Description', max: 2000 }),
    details: typeof body.details === 'string' ? body.details.trim().slice(0, 1000) : '',
    priceCents: int(body.priceCents, 'Price', { max: 10_000_000 }),
    rating: Math.round(rating * 10) / 10,
    reviewCount: int(body.reviewCount ?? 0, 'Review count', { max: 10_000_000 }),
    featured: body.featured ? 1 : 0,
    active: body.active === false || body.active === 0 ? 0 : 1,
    image,
  };
}

function variantRows(list) {
  if (!Array.isArray(list) || list.length === 0) throw new HttpError(400, 'Add at least one colour and size.');
  if (list.length > 200) throw new HttpError(400, 'Too many variants (max 200).');
  const seen = new Set();
  return list.map((v) => {
    const color = str(v?.color, { field: 'Colour name', max: 40 });
    const size = str(v?.size, { field: 'Size', max: 20 });
    const colorHex = typeof v?.colorHex === 'string' ? v.colorHex.trim() : '';
    if (!HEX_RE.test(colorHex)) throw new HttpError(400, `Colour "${color}" needs a hex value like #1c1c1e.`);
    const key = `${color.toLowerCase()}/${size.toLowerCase()}`;
    if (seen.has(key)) throw new HttpError(400, `Duplicate variant: ${color} / ${size}.`);
    seen.add(key);
    return { id: v.id == null ? null : int(v.id, 'variant id', { min: 1, max: Number.MAX_SAFE_INTEGER }), color, colorHex, size, stock: int(v?.stock ?? 0, 'Stock', { max: 100_000 }) };
  });
}

/** Makes a product's variants match `rows`: update by id, insert new, and delete the rest unless an order uses them. */
function syncVariants(productId, rows) {
  const current = db.prepare('SELECT id, color, size FROM variants WHERE product_id = ?').all(productId);
  const keep = new Set(rows.filter((r) => r.id).map((r) => r.id));
  for (const r of rows) {
    if (r.id && !current.some((c) => c.id === r.id)) throw new HttpError(400, 'A variant does not belong to this product.');
  }
  for (const c of current) {
    if (keep.has(c.id)) continue;
    if (db.prepare('SELECT 1 FROM order_items WHERE variant_id = ?').get(c.id)) {
      throw new HttpError(409, `${c.color} / ${c.size} appears on past orders and cannot be removed. Set its stock to 0 instead.`);
    }
    db.prepare('DELETE FROM variants WHERE id = ?').run(c.id);
  }
  // Two passes so swapping names between rows can't trip the unique (product, colour, size) index.
  const update = db.prepare('UPDATE variants SET color = ?, color_hex = ?, size = ?, stock = ? WHERE id = ?');
  const insert = db.prepare('INSERT INTO variants (product_id, color, color_hex, size, stock) VALUES (?, ?, ?, ?, ?)');
  const existing = rows.filter((r) => r.id);
  for (const r of existing) update.run(`__tmp${r.id}`, r.colorHex, `__tmp${r.id}`, r.stock, r.id);
  for (const r of existing) update.run(r.color, r.colorHex, r.size, r.stock, r.id);
  for (const r of rows.filter((x) => !x.id)) insert.run(productId, r.color, r.colorHex, r.size, r.stock);
}

router.get('/products', (_req, res) => {
  res.json(listProducts({ includeInactive: true, sort: 'name' }));
});

router.get('/products/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM products WHERE id = ?').get(id(req));
  if (!row) throw new HttpError(404, 'Product not found.');
  res.json(toProducts([row])[0]);
});

router.post('/products', (req, res) => {
  const body = req.body ?? {};
  const f = productFields(body);
  const variants = variantRows(body.variants);
  let slug = slugify(typeof body.slug === 'string' && body.slug.trim() ? body.slug : f.name);
  if (!slug) throw new HttpError(400, 'Could not make a URL name from that product name.');
  if (db.prepare('SELECT 1 FROM products WHERE slug = ?').get(slug)) throw new HttpError(409, `A product with the URL name "${slug}" already exists.`);

  const productId = transaction(() => {
    const { lastInsertRowid } = db
      .prepare(
        `INSERT INTO products (slug, name, category, type, description, details, price_cents, rating, review_count, featured, active, image)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(slug, f.name, f.category, f.type, f.description, f.details, f.priceCents, f.rating, f.reviewCount, f.featured, f.active, f.image);
    syncVariants(Number(lastInsertRowid), variants);
    return Number(lastInsertRowid);
  });
  res.status(201).json(toProducts([db.prepare('SELECT * FROM products WHERE id = ?').get(productId)])[0]);
});

router.put('/products/:id', (req, res) => {
  const productId = id(req);
  if (!db.prepare('SELECT 1 FROM products WHERE id = ?').get(productId)) throw new HttpError(404, 'Product not found.');
  const body = req.body ?? {};
  const f = productFields(body);
  const variants = variantRows(body.variants);
  transaction(() => {
    db.prepare(
      `UPDATE products SET name = ?, category = ?, type = ?, description = ?, details = ?, price_cents = ?,
         rating = ?, review_count = ?, featured = ?, active = ?, image = ? WHERE id = ?`,
    ).run(f.name, f.category, f.type, f.description, f.details, f.priceCents, f.rating, f.reviewCount, f.featured, f.active, f.image, productId);
    syncVariants(productId, variants);
  });
  res.json(toProducts([db.prepare('SELECT * FROM products WHERE id = ?').get(productId)])[0]);
});

// Quick toggles from the product table: { active?: boolean, featured?: boolean }
router.patch('/products/:id', (req, res) => {
  const productId = id(req);
  const row = db.prepare('SELECT * FROM products WHERE id = ?').get(productId);
  if (!row) throw new HttpError(404, 'Product not found.');
  const { active, featured } = req.body ?? {};
  if (active !== undefined) db.prepare('UPDATE products SET active = ? WHERE id = ?').run(active ? 1 : 0, productId);
  if (featured !== undefined) db.prepare('UPDATE products SET featured = ? WHERE id = ?').run(featured ? 1 : 0, productId);
  res.json(toProducts([db.prepare('SELECT * FROM products WHERE id = ?').get(productId)])[0]);
});

router.delete('/products/:id', (req, res) => {
  const productId = id(req);
  if (!db.prepare('SELECT 1 FROM products WHERE id = ?').get(productId)) throw new HttpError(404, 'Product not found.');
  if (db.prepare('SELECT 1 FROM order_items WHERE product_id = ?').get(productId)) {
    throw new HttpError(409, 'This product appears on past orders, so it cannot be deleted. Hide it from the shop instead.');
  }
  db.prepare('DELETE FROM products WHERE id = ?').run(productId); // variants cascade
  res.status(204).end();
});

// ---------------------------------------------------------------- orders

function adminOrder(row) {
  const items = db.prepare('SELECT * FROM order_items WHERE order_id = ? ORDER BY id').all(row.id);
  return {
    id: row.id,
    status: row.status,
    createdAt: row.created_at,
    subtotalCents: row.subtotal_cents,
    shippingCents: row.shipping_cents,
    totalCents: row.total_cents,
    customer: { id: row.user_id, name: row.user_name, email: row.user_email },
    shipping: { name: row.ship_name, address: row.ship_address, city: row.ship_city, zip: row.ship_zip },
    items: items.map((i) => ({ productId: i.product_id, variantId: i.variant_id, name: i.name, color: i.color, colorHex: i.color_hex, size: i.size, priceCents: i.price_cents, qty: i.qty })),
  };
}

const ORDER_SELECT = 'SELECT o.*, u.name AS user_name, u.email AS user_email FROM orders o JOIN users u ON u.id = o.user_id';

router.get('/orders', (req, res) => {
  const { status } = req.query;
  const rows = ORDER_STATUSES.includes(status)
    ? db.prepare(`${ORDER_SELECT} WHERE o.status = ? ORDER BY o.id DESC`).all(status)
    : db.prepare(`${ORDER_SELECT} ORDER BY o.id DESC`).all();
  res.json(rows.map(adminOrder));
});

router.get('/orders/:id', (req, res) => {
  const row = db.prepare(`${ORDER_SELECT} WHERE o.id = ?`).get(id(req));
  if (!row) throw new HttpError(404, 'Order not found.');
  res.json(adminOrder(row));
});

// Cancelling puts the items back in stock; reviving a cancelled order takes them out again (if there is enough).
router.patch('/orders/:id', (req, res) => {
  const orderId = id(req);
  const status = req.body?.status;
  if (!ORDER_STATUSES.includes(status)) throw new HttpError(400, `Status must be one of: ${ORDER_STATUSES.join(', ')}.`);
  transaction(() => {
    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
    if (!order) throw new HttpError(404, 'Order not found.');
    if (order.status === status) return;
    const items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(orderId);
    if (status === 'cancelled') {
      const restock = db.prepare('UPDATE variants SET stock = stock + ? WHERE id = ?');
      for (const i of items) restock.run(i.qty, i.variant_id);
    } else if (order.status === 'cancelled') {
      const take = db.prepare('UPDATE variants SET stock = stock - ? WHERE id = ? AND stock >= ?');
      for (const i of items) {
        if (take.run(i.qty, i.variant_id, i.qty).changes === 0) {
          throw new HttpError(409, `Not enough stock of "${i.name} (${i.color}, ${i.size})" to reopen this order.`);
        }
      }
    }
    db.prepare('UPDATE orders SET status = ? WHERE id = ?').run(status, orderId);
  });
  res.json(adminOrder(db.prepare(`${ORDER_SELECT} WHERE o.id = ?`).get(orderId)));
});

// ---------------------------------------------------------------- customers

router.get('/users', (_req, res) => {
  const rows = db
    .prepare(
      `SELECT u.id, u.name, u.email, u.role, u.created_at AS createdAt,
              COUNT(o.id) AS orderCount, COALESCE(SUM(CASE WHEN o.status != 'cancelled' THEN o.total_cents END), 0) AS spentCents
       FROM users u LEFT JOIN orders o ON o.user_id = u.id GROUP BY u.id ORDER BY u.id`,
    )
    .all();
  res.json(rows);
});

router.patch('/users/:id', (req, res) => {
  const userId = id(req);
  const role = req.body?.role;
  if (role !== 'admin' && role !== 'customer') throw new HttpError(400, 'Role must be "admin" or "customer".');
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
  if (!user) throw new HttpError(404, 'User not found.');
  if (role === 'customer' && user.role === 'admin') {
    if (userId === req.userId) throw new HttpError(400, 'You cannot remove your own admin access.');
    if (db.prepare("SELECT COUNT(*) AS n FROM users WHERE role = 'admin'").get().n <= 1) throw new HttpError(400, 'There must be at least one admin.');
  }
  db.prepare('UPDATE users SET role = ? WHERE id = ?').run(role, userId);
  res.json({ id: userId, role });
});

router.delete('/users/:id', (req, res) => {
  const userId = id(req);
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
  if (!user) throw new HttpError(404, 'User not found.');
  if (userId === req.userId) throw new HttpError(400, 'You cannot delete your own account.');
  if (user.role === 'admin') throw new HttpError(400, 'Make this user a customer before deleting them.');
  if (db.prepare('SELECT 1 FROM orders WHERE user_id = ?').get(userId)) throw new HttpError(409, 'This customer has orders, so the account cannot be deleted.');
  db.prepare('DELETE FROM users WHERE id = ?').run(userId);
  res.status(204).end();
});

// ---------------------------------------------------------------- categories

router.get('/categories', (_req, res) => {
  res.json(
    db
      .prepare('SELECT c.key, c.title, c.blurb, c.image, c.sort_order AS sortOrder, (SELECT COUNT(*) FROM products p WHERE p.category = c.key) AS productCount FROM categories c ORDER BY c.sort_order, c.title')
      .all(),
  );
});

function categoryFields(body) {
  let image = body.image ?? null;
  if (image) {
    image = str(image, { field: 'Image', max: 500 });
    if (!/^(\/images\/|\/api\/uploads\/|https:\/\/)/.test(image)) throw new HttpError(400, 'Image must be an uploaded file or an https:// link.');
  }
  return {
    title: str(body.title, { field: 'Title', max: 60 }),
    blurb: typeof body.blurb === 'string' ? body.blurb.trim().slice(0, 120) : '',
    image: image || null,
    sortOrder: int(body.sortOrder ?? 0, 'Order', { max: 1000 }),
  };
}

router.post('/categories', (req, res) => {
  const key = slugify(str(req.body?.key ?? req.body?.title, { field: 'Name', max: 40 }));
  if (!key) throw new HttpError(400, 'Name is required.');
  if (db.prepare('SELECT 1 FROM categories WHERE key = ?').get(key)) throw new HttpError(409, `Category "${key}" already exists.`);
  const f = categoryFields(req.body ?? {});
  db.prepare('INSERT INTO categories (key, title, blurb, image, sort_order) VALUES (?, ?, ?, ?, ?)').run(key, f.title, f.blurb, f.image, f.sortOrder);
  res.status(201).json({ key, ...f, productCount: 0 });
});

router.put('/categories/:key', (req, res) => {
  const { key } = req.params;
  if (!db.prepare('SELECT 1 FROM categories WHERE key = ?').get(key)) throw new HttpError(404, 'Category not found.');
  const f = categoryFields(req.body ?? {});
  db.prepare('UPDATE categories SET title = ?, blurb = ?, image = ?, sort_order = ? WHERE key = ?').run(f.title, f.blurb, f.image, f.sortOrder, key);
  res.json({ key, ...f });
});

router.delete('/categories/:key', (req, res) => {
  const { key } = req.params;
  if (!db.prepare('SELECT 1 FROM categories WHERE key = ?').get(key)) throw new HttpError(404, 'Category not found.');
  if (db.prepare('SELECT 1 FROM products WHERE category = ?').get(key)) throw new HttpError(409, 'Move or delete the products in this category first.');
  db.prepare('DELETE FROM categories WHERE key = ?').run(key);
  res.status(204).end();
});

// ---------------------------------------------------------------- site settings

router.get('/settings', (_req, res) => res.json(getSettings()));
router.put('/settings', (req, res) => res.json(updateSettings(req.body)));

// ---------------------------------------------------------------- image upload

// POST the raw image bytes with the matching Content-Type. The type is checked against the file's own header bytes.
const SIGNATURES = {
  'image/jpeg': { ext: 'jpg', test: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  'image/png': { ext: 'png', test: (b) => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) },
  'image/webp': { ext: 'webp', test: (b) => b.subarray(0, 4).toString() === 'RIFF' && b.subarray(8, 12).toString() === 'WEBP' },
};

router.post('/uploads', express.raw({ type: Object.keys(SIGNATURES), limit: '5mb' }), (req, res) => {
  const type = req.get('content-type')?.split(';')[0];
  const sig = SIGNATURES[type];
  if (!sig || !Buffer.isBuffer(req.body) || req.body.length === 0) throw new HttpError(415, 'Upload a JPEG, PNG or WebP image (up to 5 MB).');
  if (!sig.test(req.body)) throw new HttpError(400, 'That file is not a valid image.');
  const name = `${crypto.randomBytes(12).toString('hex')}.${sig.ext}`;
  fs.writeFileSync(path.join(UPLOAD_DIR, name), req.body);
  res.status(201).json({ url: `/api/uploads/${name}` });
});

export default router;
