import { Router } from 'express';
import { db } from '../db.js';
import { HttpError } from '../http.js';

const router = Router();

const SORTS = {
  featured: 'p.featured DESC, p.review_count DESC',
  'price-asc': 'p.price_cents ASC',
  'price-desc': 'p.price_cents DESC',
  rating: 'p.rating DESC, p.review_count DESC',
  name: 'p.name COLLATE NOCASE ASC',
};

function variantsByProduct(productIds) {
  const map = new Map();
  if (productIds.length === 0) return map;
  const marks = productIds.map(() => '?').join(',');
  const rows = db.prepare(`SELECT * FROM variants WHERE product_id IN (${marks}) ORDER BY id`).all(...productIds);
  for (const v of rows) {
    if (!map.has(v.product_id)) map.set(v.product_id, []);
    map.get(v.product_id).push({ id: v.id, color: v.color, colorHex: v.color_hex, size: v.size, stock: v.stock });
  }
  return map;
}

function toProduct(row, variants) {
  const colors = [];
  const sizes = [];
  for (const v of variants) {
    if (!colors.some((c) => c.name === v.color)) colors.push({ name: v.color, hex: v.colorHex });
    if (!sizes.includes(v.size)) sizes.push(v.size);
  }
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    category: row.category,
    type: row.type,
    description: row.description,
    details: row.details,
    priceCents: row.price_cents,
    rating: row.rating,
    reviewCount: row.review_count,
    featured: Boolean(row.featured),
    colors,
    sizes,
    variants,
    inStock: variants.some((v) => v.stock > 0),
  };
}

function toProducts(rows) {
  const variants = variantsByProduct(rows.map((r) => r.id));
  return rows.map((r) => toProduct(r, variants.get(r.id) ?? []));
}

// GET /api/products?category=women&type=dresses&q=linen&sort=price-asc&featured=1
router.get('/', (req, res) => {
  const { category, type, q, sort = 'featured', featured } = req.query;
  const where = [];
  const params = [];

  if (typeof category === 'string' && category) {
    where.push('p.category = ?');
    params.push(category);
  }
  if (typeof type === 'string' && type) {
    where.push('p.type = ?');
    params.push(type);
  }
  if (featured === '1') where.push('p.featured = 1');
  if (typeof q === 'string' && q.trim()) {
    const like = `%${q.trim().replace(/[%_\\]/g, (c) => `\\${c}`)}%`;
    where.push(`(p.name LIKE ? ESCAPE '\\' OR p.type LIKE ? ESCAPE '\\' OR p.category LIKE ? ESCAPE '\\' OR p.description LIKE ? ESCAPE '\\')`);
    params.push(like, like, like, like);
  }

  const orderBy = SORTS[sort] || SORTS.featured;
  const sql = `SELECT p.* FROM products p ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY ${orderBy}`;
  res.json(toProducts(db.prepare(sql).all(...params)));
});

// GET /api/products/meta -> categories and their product types, for building filters
router.get('/meta', (_req, res) => {
  const rows = db.prepare('SELECT category, type, COUNT(*) AS n FROM products GROUP BY category, type ORDER BY category, type').all();
  const categories = {};
  for (const r of rows) (categories[r.category] ||= []).push({ type: r.type, count: r.n });
  res.json({ categories });
});

router.get('/:slug', (req, res) => {
  const row = db.prepare('SELECT * FROM products WHERE slug = ?').get(req.params.slug);
  if (!row) throw new HttpError(404, 'Product not found.');
  const related = db
    .prepare('SELECT * FROM products WHERE category = ? AND id != ? ORDER BY (type = ?) DESC, rating DESC LIMIT 4')
    .all(row.category, row.id, row.type);
  const [product] = toProducts([row]);
  res.json({ ...product, related: toProducts(related) });
});

export default router;
