import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { db, dataDir, transaction } from './db.js';
import { C, LAUNCH_PRODUCTS } from './seedData.js';
import { BATCH_2_PRODUCTS } from './seedBatch2.js';

// Photos that ship with the storefront. A product whose slug has a file here gets it as its starting image.
const PHOTO_DIR = path.join(dataDir, '..', '..', 'frontend', 'public', 'images', 'products');
const photoFor = (slug) => (fs.existsSync(path.join(PHOTO_DIR, `${slug}.jpg`)) ? `/images/products/${slug}.jpg` : null);

const CATEGORIES = [
  ['women', 'Women', 'Dresses, knitwear, denim', '/images/products/wrap-midi-dress.jpg'],
  ['men', 'Men', 'Tees, hoodies, shirts', '/images/products/heavyweight-hoodie.jpg'],
  ['accessories', 'Accessories', 'Caps, beanies, totes', '/images/products/rib-beanie.jpg'],
];

/** Deterministic pseudo-random stock so a re-seed gives the same shop. About one in nine variants is sold out. */
function stockFor(key) {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) h = Math.imul(h ^ key.charCodeAt(i), 16777619);
  const n = (h >>> 0) % 18;
  return n < 2 ? 0 : n < 4 ? 2 + (n % 3) : 8 + n;
}

function insertProducts(rows) {
  const exists = db.prepare('SELECT 1 FROM products WHERE slug = ?');
  const insertProduct = db.prepare(`
    INSERT INTO products (slug, name, category, type, price_cents, rating, review_count, featured, description, details, image)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insertVariant = db.prepare('INSERT INTO variants (product_id, color, color_hex, size, stock) VALUES (?, ?, ?, ?, ?)');
  let added = 0;
  for (const [slug, name, category, type, price, rating, reviews, featured, colors, sizes, description, details] of rows) {
    if (exists.get(slug)) continue;
    const { lastInsertRowid } = insertProduct.run(slug, name, category, type, price, rating, reviews, featured, description, details, photoFor(slug));
    for (const key of colors) {
      const [colorName, hex] = C[key];
      for (const size of sizes) insertVariant.run(lastInsertRowid, colorName, hex, size, stockFor(`${slug}/${colorName}/${size}`));
    }
    added++;
  }
  return added;
}

/**
 * Each seed step runs once per database and is remembered in the settings table, so anything an admin later
 * deletes or edits is never put back on the next start.
 */
function once(step, fn) {
  const flag = `seed:${step}`;
  if (db.prepare('SELECT 1 FROM settings WHERE key = ?').get(flag)) return 0;
  const result = fn();
  db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)').run(flag, '1');
  return result;
}

/** Brings the database up to date with the bundled catalog. Returns how many products were added. */
export function seedIfEmpty() {
  return transaction(() => {
    const hadProducts = db.prepare('SELECT COUNT(*) AS n FROM products').get().n > 0;
    let added = 0;

    // Databases created before the admin existed already hold the launch products: just record that.
    added += once('launch', () => (hadProducts ? 0 : insertProducts(LAUNCH_PRODUCTS)));
    added += once('batch2', () => insertProducts(BATCH_2_PRODUCTS));

    once('categories', () => {
      const insert = db.prepare('INSERT OR IGNORE INTO categories (key, title, blurb, image, sort_order) VALUES (?, ?, ?, ?, ?)');
      CATEGORIES.forEach(([key, title, blurb, image], i) => insert.run(key, title, blurb, image, i));
    });

    // Existing products had photos found by slug; give them an explicit image so the admin can change or clear it.
    once('images', () => {
      const rows = db.prepare('SELECT id, slug FROM products WHERE image IS NULL').all();
      const set = db.prepare('UPDATE products SET image = ? WHERE id = ?');
      for (const { id, slug } of rows) {
        const photo = photoFor(slug);
        if (photo) set.run(photo, id);
      }
    });

    return added;
  });
}

// `npm run seed` re-applies the bundled catalog. `--reset` wipes products and categories first, and is refused once
// any order references a product (orders keep their own item snapshots, but the links must stay valid).
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (process.argv.includes('--reset')) {
    const used = db.prepare('SELECT COUNT(*) AS n FROM order_items').get().n;
    if (used > 0) {
      console.error('Refusing to reset: orders reference existing products. Delete data/threads.db to start over.');
      process.exit(1);
    }
    db.exec("DELETE FROM products; DELETE FROM categories; DELETE FROM settings WHERE key LIKE 'seed:%';");
  }
  const added = seedIfEmpty();
  console.log(added > 0 ? `Seeded ${added} products.` : 'Catalog already up to date; nothing to do.');
}
