import { db, transaction } from './db.js';
import { HttpError } from './http.js';

const TRANSITIONS = {
  paid: ['processing', 'cancelled'],
  processing: ['shipped', 'cancelled'],
  shipped: ['delivered'],
  delivered: [],
  cancelled: ['paid'],
};

export const ORDER_STATUSES = Object.keys(TRANSITIONS);
export const canCancelOrder = (status) => status === 'paid' || status === 'processing';
export const allowedOrderStatuses = (status) => [status, ...(TRANSITIONS[status] ?? [])];

// Both staff and customer changes use one transaction and the same stock rules.
// Passing a customer ID scopes the lookup, so foreign orders also return 404.
export function changeOrderStatus(orderId, status, customerId) {
  if (!Number.isSafeInteger(orderId) || orderId < 1) throw new HttpError(404, 'Order not found.');
  if (!ORDER_STATUSES.includes(status)) throw new HttpError(400, `Status must be one of: ${ORDER_STATUSES.join(', ')}.`);
  return transaction(() => {
    const order = customerId === undefined
      ? db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId)
      : db.prepare('SELECT * FROM orders WHERE id = ? AND user_id = ?').get(orderId, customerId);
    if (!order) throw new HttpError(404, 'Order not found.');
    if (customerId !== undefined && status !== 'cancelled') throw new HttpError(403, 'Customers may only cancel their orders.');
    if (order.status === status) return;
    if (!TRANSITIONS[order.status]?.includes(status)) {
      throw new HttpError(409, `An order that is ${order.status} cannot be changed to ${status}.`);
    }
    const items = db.prepare('SELECT * FROM order_items WHERE order_id = ? ORDER BY id').all(orderId);
    if (status === 'cancelled') {
      const restock = db.prepare('UPDATE variants SET stock = stock + ? WHERE id = ?');
      for (const item of items) restock.run(item.qty, item.variant_id);
    } else if (order.status === 'cancelled') {
      const take = db.prepare('UPDATE variants SET stock = stock - ? WHERE id = ? AND stock >= ?');
      for (const item of items) {
        if (take.run(item.qty, item.variant_id, item.qty).changes === 0) {
          throw new HttpError(409, `Not enough stock of "${item.name} (${item.color}, ${item.size})" to reopen this order.`);
        }
      }
    }
    db.prepare('UPDATE orders SET status = ? WHERE id = ?').run(status, orderId);
  });
}
