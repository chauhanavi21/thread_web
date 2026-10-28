import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const dataDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'data');
fs.mkdirSync(dataDir, { recursive: true });

export const db = new DatabaseSync(path.join(dataDir, 'threads.db'));

db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;

  CREATE TABLE IF NOT EXISTS users (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    name          TEXT NOT NULL,
    email         TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at    TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS products (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    slug         TEXT NOT NULL UNIQUE,
    name         TEXT NOT NULL,
    category     TEXT NOT NULL,          -- men | women | accessories
    type         TEXT NOT NULL,          -- t-shirts, hoodies, jeans, ...
    description  TEXT NOT NULL,
    details      TEXT NOT NULL DEFAULT '',  -- fabric and care
    price_cents  INTEGER NOT NULL CHECK (price_cents >= 0),
    rating       REAL NOT NULL DEFAULT 4.5,
    review_count INTEGER NOT NULL DEFAULT 0,
    featured     INTEGER NOT NULL DEFAULT 0
  );

  CREATE INDEX IF NOT EXISTS idx_products_category ON products (category, type);

  -- One row per purchasable size/colour combination. Stock lives here, not on the product.
  CREATE TABLE IF NOT EXISTS variants (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER NOT NULL REFERENCES products (id) ON DELETE CASCADE,
    color      TEXT NOT NULL,
    color_hex  TEXT NOT NULL,
    size       TEXT NOT NULL,
    stock      INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
    UNIQUE (product_id, color, size)
  );

  -- Shop sections, managed from the admin. "key" is the URL value used by products.category.
  CREATE TABLE IF NOT EXISTS categories (
    key        TEXT PRIMARY KEY,
    title      TEXT NOT NULL,
    blurb      TEXT NOT NULL DEFAULT '',
    image      TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS settings (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS orders (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id        INTEGER NOT NULL REFERENCES users (id),
    subtotal_cents INTEGER NOT NULL,
    shipping_cents INTEGER NOT NULL,
    total_cents    INTEGER NOT NULL,
    status         TEXT NOT NULL DEFAULT 'paid',
    ship_name      TEXT NOT NULL,
    ship_address   TEXT NOT NULL,
    ship_city      TEXT NOT NULL,
    ship_zip       TEXT NOT NULL,
    created_at     TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_orders_user ON orders (user_id, created_at);

  -- Name, colour, size and price are copied onto the line so old orders never change.
  CREATE TABLE IF NOT EXISTS order_items (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id    INTEGER NOT NULL REFERENCES orders (id) ON DELETE CASCADE,
    product_id  INTEGER NOT NULL REFERENCES products (id),
    variant_id  INTEGER NOT NULL REFERENCES variants (id),
    name        TEXT NOT NULL,
    color       TEXT NOT NULL,
    color_hex   TEXT NOT NULL,
    size        TEXT NOT NULL,
    price_cents INTEGER NOT NULL,
    qty         INTEGER NOT NULL CHECK (qty > 0)
  );
`);

// Columns added after the first release. Existing databases are upgraded in place.
function addColumn(table, column, ddl) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all();
  if (!cols.some((c) => c.name === column)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${ddl}`);
}
addColumn('users', 'role', "TEXT NOT NULL DEFAULT 'customer'"); // customer | admin
addColumn('products', 'active', 'INTEGER NOT NULL DEFAULT 1'); // 0 = hidden from the shop
addColumn('products', 'image', 'TEXT'); // URL of the product photo, or null for the drawn fallback

/** Runs fn inside a write transaction; rolls back if it throws. */
export function transaction(fn) {
  db.exec('BEGIN IMMEDIATE');
  try {
    const result = fn();
    db.exec('COMMIT');
    return result;
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}
