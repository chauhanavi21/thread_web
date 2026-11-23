import { db, transaction } from './db.js';
import { HttpError, str } from './http.js';
import { getSettings } from './settings.js';
import { fingerprint, validateRequestKey } from './idempotency.js';

const ACTIVE = "('requested', 'approved', 'completed')";
const integer = (value) => Number.isSafeInteger(value) && value > 0;
export const RETURN_STATUSES = ['requested', 'approved', 'completed', 'rejected', 'cancelled'];
const timestamp = (value) => Date.parse(value && (/Z$|[+-]\d\d:\d\d$/.test(value) ? value : `${value.replace(' ', 'T')}Z`));

export function returnEligibility(order, now = new Date()) {
  const expires = timestamp(order.completed_at) + getSettings().returnWindowDays * 86400000;
  const eligible = ['delivered', 'collected'].includes(order.status) && Number.isFinite(expires) && now.getTime() < expires;
  const claimed = new Map(db.prepare(`
    SELECT i.order_item_id, SUM(i.qty) AS qty FROM return_case_items i
    JOIN return_cases c ON c.id = i.case_id WHERE c.order_id = ? AND c.status IN ${ACTIVE}
    GROUP BY i.order_item_id
  `).all(order.id).map((row) => [row.order_item_id, row.qty]));
  return {
    eligible,
    returnWindowEndsAt: Number.isFinite(expires) ? new Date(expires).toISOString() : null,
    availableQty: (item) => eligible ? Math.max(0, item.qty - (claimed.get(item.id) ?? 0)) : 0,
  };
}

export function loadReturnCase(caseId) {
  const row = db.prepare('SELECT c.*, o.ship_name AS customer, o.user_id AS customer_id FROM return_cases c JOIN orders o ON o.id = c.order_id WHERE c.id = ?').get(caseId);
  if (!row) throw new HttpError(404, 'Return request not found.');
  return {
    id: row.id, orderId: row.order_id, kind: row.kind, status: row.status,
    reason: row.reason, refundCents: row.refund_cents, createdAt: row.created_at, completedAt: row.completed_at,
    customer: row.customer,
    canCancel: ['requested', 'approved'].includes(row.status),
    allowedActions: row.status === 'requested' ? ['approve', 'reject'] : row.status === 'approved' ? ['complete', 'reject'] : [],
    items: db.prepare(`SELECT ri.*, oi.name, oi.color, oi.size, oi.price_cents
      FROM return_case_items ri JOIN order_items oi ON oi.id = ri.order_item_id
      WHERE ri.case_id = ? ORDER BY ri.id`).all(caseId).map((i) => ({
      id: i.id, orderItemId: i.order_item_id, name: i.name, color: i.color, size: i.size,
      priceCents: i.price_cents, qty: i.qty, restock: i.restock === null ? null : Boolean(i.restock),
      replacement: i.replacement_variant_id === null ? null : { variantId: i.replacement_variant_id, color: i.replacement_color, size: i.replacement_size },
    })),
  };
}

export function orderReturnCases(orderId) {
  return db.prepare('SELECT id FROM return_cases WHERE order_id = ? ORDER BY id DESC').all(orderId).map(({ id }) => loadReturnCase(id));
}

export function createReturnCase(orderId, actorId, body, { staff = false, requestKey, now = new Date() } = {}) {
  if (!integer(orderId)) throw new HttpError(404, 'Order not found.');
  validateRequestKey(requestKey);
  if (!['return', 'exchange'].includes(body?.kind)) throw new HttpError(400, 'Choose a return or exchange.');
  const reason = str(body.reason, { field: 'Reason', max: 500 });
  if (!Array.isArray(body.items) || !body.items.length || body.items.length > 50) throw new HttpError(400, 'Choose 1 to 50 order items.');
  const seen = new Set();
  const requested = body.items.map((item) => {
    if (!integer(item?.orderItemId) || !integer(item?.qty) || seen.has(item.orderItemId)) throw new HttpError(400, 'Each order item needs a positive whole quantity and may appear once.');
    seen.add(item.orderItemId);
    const replacementVariantId = body.kind === 'exchange' ? item.replacementVariantId : null;
    if (body.kind === 'exchange' && !integer(replacementVariantId)) throw new HttpError(400, 'Choose a replacement size and colour.');
    return { orderItemId: item.orderItemId, qty: item.qty, replacementVariantId };
  }).sort((a, b) => a.orderItemId - b.orderItemId);
  const hash = fingerprint({ orderId, kind: body.kind, reason, items: requested });
  let replayed = false;
  const caseId = transaction(() => {
    const order = staff
      ? db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId)
      : db.prepare('SELECT * FROM orders WHERE id = ? AND user_id = ?').get(orderId, actorId);
    if (!order) throw new HttpError(404, 'Order not found.');
    if (requestKey) {
      const previous = db.prepare('SELECT id, request_hash FROM return_cases WHERE requested_by = ? AND request_key = ?').get(actorId, requestKey);
      if (previous) {
        if (previous.request_hash !== hash) throw new HttpError(409, 'This request key has already been used for different return details.');
        replayed = true;
        return previous.id;
      }
    }
    const eligibility = returnEligibility(order, now);
    if (!eligibility.eligible) throw new HttpError(409, 'Returns and exchanges are available after completion and within the return window.');
    const lines = requested.map((item) => {
      const original = db.prepare('SELECT * FROM order_items WHERE id = ? AND order_id = ?').get(item.orderItemId, orderId);
      if (!original) throw new HttpError(400, 'An item does not belong to this order.');
      if (item.qty > eligibility.availableQty(original)) throw new HttpError(409, 'This quantity has already been returned or included in another open request.');
      const replacement = item.replacementVariantId === null ? null : db.prepare('SELECT v.*, p.active FROM variants v JOIN products p ON p.id = v.product_id WHERE v.id = ?').get(item.replacementVariantId);
      if (body.kind === 'exchange' && (!replacement || !replacement.active || replacement.product_id !== original.product_id || replacement.id === original.variant_id)) {
        throw new HttpError(400, 'An exchange must use a different size or colour of the same available product.');
      }
      return { ...item, original, replacement };
    });
    const refund = body.kind === 'return' ? lines.reduce((sum, line) => sum + line.original.price_cents * line.qty, 0) : 0;
    const result = db.prepare(`INSERT INTO return_cases (order_id, requested_by, kind, reason, refund_cents, request_key, request_hash, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(orderId, actorId, body.kind, reason, refund, requestKey ?? null, hash, now.toISOString());
    const insert = db.prepare('INSERT INTO return_case_items (case_id, order_item_id, qty, replacement_variant_id, replacement_color, replacement_size) VALUES (?, ?, ?, ?, ?, ?)');
    for (const line of lines) insert.run(result.lastInsertRowid, line.orderItemId, line.qty, line.replacementVariantId, line.replacement?.color ?? null, line.replacement?.size ?? null);
    return Number(result.lastInsertRowid);
  });
  return { returnCase: loadReturnCase(caseId), replayed };
}

export function actOnReturnCase(caseId, action, body = {}, { customerId, now = new Date() } = {}) {
  if (!integer(caseId)) throw new HttpError(404, 'Return request not found.');
  if (!['approve', 'reject', 'complete', 'cancel'].includes(action)) throw new HttpError(400, 'Unknown return action.');
  transaction(() => {
    const row = customerId === undefined
      ? db.prepare('SELECT * FROM return_cases WHERE id = ?').get(caseId)
      : db.prepare('SELECT c.* FROM return_cases c JOIN orders o ON o.id = c.order_id WHERE c.id = ? AND o.user_id = ?').get(caseId, customerId);
    if (!row) throw new HttpError(404, 'Return request not found.');
    if (customerId !== undefined && action !== 'cancel') throw new HttpError(403, 'Staff access required.');
    const target = { approve: 'approved', reject: 'rejected', complete: 'completed', cancel: 'cancelled' }[action];
    if (row.status === target) return;
    if (!(row.status === 'requested' && ['approve', 'reject', 'cancel'].includes(action)) && !(row.status === 'approved' && ['complete', 'reject', 'cancel'].includes(action))) {
      throw new HttpError(409, `A ${row.status} request cannot be changed by this action.`);
    }
    const items = db.prepare('SELECT ri.*, oi.variant_id FROM return_case_items ri JOIN order_items oi ON oi.id = ri.order_item_id WHERE ri.case_id = ? ORDER BY ri.id').all(caseId);
    if (action === 'approve' && row.kind === 'exchange') {
      const reserve = db.prepare('UPDATE variants SET stock = stock - ? WHERE id = ? AND stock >= ?');
      for (const item of items) {
        const replacement = db.prepare('SELECT v.*, p.active FROM variants v JOIN products p ON p.id = v.product_id WHERE v.id = ?').get(item.replacement_variant_id);
        if (!replacement?.active || replacement.color !== item.replacement_color || replacement.size !== item.replacement_size || reserve.run(item.qty, item.replacement_variant_id, item.qty).changes === 0) {
          throw new HttpError(409, 'A replacement is no longer available. No replacement stock was reserved.');
        }
      }
    }
    if (row.status === 'approved' && ['reject', 'cancel'].includes(action) && row.kind === 'exchange') {
      for (const item of items) db.prepare('UPDATE variants SET stock = stock + ? WHERE id = ?').run(item.qty, item.replacement_variant_id);
    }
    if (action === 'complete') {
      if (!Array.isArray(body.inspections) || body.inspections.length !== items.length || new Set(body.inspections.map((i) => i?.itemId)).size !== items.length) {
        throw new HttpError(400, 'Inspect every returned item exactly once.');
      }
      if (row.refund_cents > 0 && body.confirmRefund !== true) throw new HttpError(400, 'Confirm that the refund has been recorded outside the payment processor.');
      for (const item of items) {
        const inspection = body.inspections.find((entry) => entry?.itemId === item.id);
        if (!inspection || typeof inspection.restock !== 'boolean') throw new HttpError(400, 'Choose whether each returned item can be resold.');
        if (inspection.restock) db.prepare('UPDATE variants SET stock = stock + ? WHERE id = ?').run(item.qty, item.variant_id);
        db.prepare('UPDATE return_case_items SET restock = ? WHERE id = ?').run(inspection.restock ? 1 : 0, item.id);
      }
    }
    db.prepare('UPDATE return_cases SET status = ?, completed_at = ? WHERE id = ?').run(target, action === 'complete' ? now.toISOString() : null, caseId);
  });
  return loadReturnCase(caseId);
}
