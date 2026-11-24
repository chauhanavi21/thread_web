import { db } from './db.js';
import { HttpError } from './http.js';

// These helpers run inside the caller's write transaction. Online and counter
// purchases read prices and consume the same variant rows.
export function loadPricedLines(wanted, maximum) {
  const getVariant = db.prepare('SELECT v.*, p.name AS product_name, p.price_cents, p.active FROM variants v JOIN products p ON p.id = v.product_id WHERE v.id = ?');
  return [...wanted].map(([variantId, qty]) => {
    const v = getVariant.get(variantId);
    if (!v || !v.active) throw new HttpError(400, 'One of the items is no longer available.');
    const label = `${v.product_name} (${v.color}, ${v.size})`;
    if (qty > maximum) throw new HttpError(400, `You can order at most ${maximum} of "${label}".`);
    if (v.stock < qty) throw new HttpError(409, v.stock === 0 ? `"${label}" is out of stock.` : `Only ${v.stock} of "${label}" left in stock.`);
    return { v, qty };
  });
}

export function saveOrderItems(orderId, lines) {
  const insert = db.prepare(`INSERT INTO order_items (order_id, product_id, variant_id, name, color, color_hex, size, price_cents, qty)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  const decrement = db.prepare('UPDATE variants SET stock = stock - ? WHERE id = ? AND stock >= ?');
  for (const { v, qty } of lines) {
    if (decrement.run(qty, v.id, qty).changes !== 1) throw new HttpError(409, 'Stock changed. Review the items and try again.');
    insert.run(orderId, v.product_id, v.id, v.product_name, v.color, v.color_hex, v.size, v.price_cents, qty);
  }
}
