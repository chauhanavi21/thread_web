import { db } from './db.js';
import { canCancelOrder } from './orderStatus.js';
import { orderReturnCases, returnEligibility } from './returns.js';

export function loadOrder(orderId) {
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
  const items = db
    .prepare('SELECT oi.*, p.slug, p.type, p.image FROM order_items oi JOIN products p ON p.id = oi.product_id WHERE oi.order_id = ? ORDER BY oi.id')
    .all(orderId);
  const eligibility = returnEligibility(order);
  return {
    id: order.id,
    status: order.status,
    channel: order.channel,
    fulfillment: order.fulfillment,
    paymentMethod: order.payment_method,
    paymentStatus: order.payment_status,
    cashReceivedCents: order.cash_received_cents,
    changeCents: order.cash_received_cents === null ? null : order.cash_received_cents - order.total_cents,
    canCancel: order.channel === 'online' && canCancelOrder(order.status),
    createdAt: order.created_at,
    subtotalCents: order.subtotal_cents,
    shippingCents: order.shipping_cents,
    totalCents: order.total_cents,
    returnWindowEndsAt: eligibility.returnWindowEndsAt,
    returnCases: orderReturnCases(orderId),
    shipping: { name: order.ship_name, address: order.ship_address, city: order.ship_city, zip: order.ship_zip },
    items: items.map((i) => ({
      id: i.id,
      returnableQty: eligibility.availableQty(i),
      productId: i.product_id,
      variantId: i.variant_id,
      slug: i.slug,
      type: i.type,
      image: i.image,
      name: i.name,
      color: i.color,
      colorHex: i.color_hex,
      size: i.size,
      priceCents: i.price_cents,
      qty: i.qty,
    })),
  };
}

