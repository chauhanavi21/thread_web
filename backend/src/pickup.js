import { db, transaction } from './db.js';
import { HttpError } from './http.js';

const EXPIRABLE = "fulfillment = 'pickup' AND status IN ('reserved', 'ready') AND pickup_expires_at <= ?";

export function expirePickupReservations(now = new Date()) {
  const deadline = now.toISOString();
  if (!db.prepare(`SELECT 1 FROM orders WHERE ${EXPIRABLE} LIMIT 1`).get(deadline)) return 0;
  return transaction(() => {
    const orders = db.prepare(`SELECT id FROM orders WHERE ${EXPIRABLE}`).all(deadline);
    const items = db.prepare('SELECT variant_id, qty FROM order_items WHERE order_id = ?');
    const restock = db.prepare('UPDATE variants SET stock = stock + ? WHERE id = ?');
    for (const order of orders) {
      for (const item of items.all(order.id)) restock.run(item.qty, item.variant_id);
      db.prepare("UPDATE orders SET status = 'expired' WHERE id = ?").run(order.id);
    }
    return orders.length;
  });
}

export function startPickupExpiry() {
  expirePickupReservations();
  const timer = setInterval(() => {
    try { expirePickupReservations(); } catch (err) { console.error('Could not expire pickup reservations:', err); }
  }, 30000);
  timer.unref();
  return () => clearInterval(timer);
}

export function collectPickup(orderId, cashReceivedCents, now = new Date()) {
  if (!Number.isSafeInteger(orderId) || orderId < 1) throw new HttpError(404, 'Pickup not found.');
  if (!Number.isSafeInteger(cashReceivedCents) || cashReceivedCents < 0) throw new HttpError(400, 'Enter cash received in whole cents.');
  expirePickupReservations(now);
  transaction(() => {
    const order = db.prepare("SELECT * FROM orders WHERE id = ? AND fulfillment = 'pickup'").get(orderId);
    if (!order) throw new HttpError(404, 'Pickup not found.');
    if (order.status === 'collected') {
      if (order.cash_received_cents !== cashReceivedCents) throw new HttpError(409, 'This pickup has already been collected with a different cash amount.');
      return;
    }
    if (order.status !== 'ready') throw new HttpError(409, `A pickup that is ${order.status} cannot be collected. Mark it ready first.`);
    if (order.pickup_expires_at <= now.toISOString()) throw new HttpError(409, 'This pickup reservation has expired.');
    if (cashReceivedCents < order.total_cents) throw new HttpError(400, 'Cash received must cover the amount due.');
    db.prepare("UPDATE orders SET status = 'collected', payment_status = 'paid', cash_received_cents = ?, completed_at = ? WHERE id = ?")
      .run(cashReceivedCents, now.toISOString(), orderId);
  });
}
