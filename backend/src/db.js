import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { notifyInventoryChanged } from './inventoryEvents.js';

export const dataDir = process.env.THREADS_DATA_DIR
  ? path.resolve(process.env.THREADS_DATA_DIR)
  : path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'data');
fs.mkdirSync(dataDir, { recursive: true });

export const db = new DatabaseSync(path.join(dataDir, 'threads.db'));

db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;
  PRAGMA busy_timeout = 5000;

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

  CREATE TABLE IF NOT EXISTS checkout_requests (
    user_id      INTEGER NOT NULL REFERENCES users (id),
    request_key  TEXT NOT NULL,
    request_hash TEXT NOT NULL,
    order_id     INTEGER NOT NULL UNIQUE REFERENCES orders (id) ON DELETE CASCADE,
    PRIMARY KEY (user_id, request_key)
  );

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

  CREATE TABLE IF NOT EXISTS return_cases (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    requested_by INTEGER NOT NULL REFERENCES users(id),
    kind TEXT NOT NULL CHECK (kind IN ('return', 'exchange')),
    status TEXT NOT NULL DEFAULT 'requested' CHECK (status IN ('requested', 'approved', 'completed', 'rejected', 'cancelled')),
    reason TEXT NOT NULL,
    refund_cents INTEGER NOT NULL DEFAULT 0 CHECK (refund_cents >= 0),
    request_key TEXT,
    request_hash TEXT,
    created_at TEXT NOT NULL,
    completed_at TEXT,
    UNIQUE (requested_by, request_key)
  );
  CREATE INDEX IF NOT EXISTS idx_return_cases_order ON return_cases(order_id);
  CREATE TABLE IF NOT EXISTS return_case_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    case_id INTEGER NOT NULL REFERENCES return_cases(id) ON DELETE CASCADE,
    order_item_id INTEGER NOT NULL REFERENCES order_items(id) ON DELETE CASCADE,
    qty INTEGER NOT NULL CHECK (qty > 0),
    replacement_variant_id INTEGER REFERENCES variants(id),
    replacement_color TEXT,
    replacement_size TEXT,
    restock INTEGER CHECK (restock IN (0, 1)),
    UNIQUE (case_id, order_item_id)
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
addColumn('orders', 'completed_at', 'TEXT');
addColumn('orders', 'channel', "TEXT NOT NULL DEFAULT 'online' CHECK (channel IN ('online', 'counter'))");
addColumn('orders', 'fulfillment', "TEXT NOT NULL DEFAULT 'shipping' CHECK (fulfillment IN ('shipping', 'pickup', 'counter'))");
addColumn('orders', 'payment_method', "TEXT NOT NULL DEFAULT 'demo' CHECK (payment_method IN ('demo', 'cash'))");
addColumn('orders', 'payment_status', "TEXT NOT NULL DEFAULT 'paid' CHECK (payment_status IN ('paid', 'unpaid'))");
addColumn('orders', 'cash_received_cents', 'INTEGER CHECK (cash_received_cents >= 0)');
addColumn('orders', 'created_by', 'INTEGER REFERENCES users(id)');
// Historical deliveries did not record a completion time; retain their original
// creation time as the conservative start of the return window.
db.exec("UPDATE orders SET completed_at = created_at WHERE status = 'delivered' AND completed_at IS NULL");

/** Runs fn inside a write transaction; rolls back if it throws. */
export function transaction(fn) {
  db.exec('BEGIN IMMEDIATE');
  try {
    const result = fn();
    db.exec('COMMIT');
    queueMicrotask(notifyInventoryChanged);
    return result;
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}
