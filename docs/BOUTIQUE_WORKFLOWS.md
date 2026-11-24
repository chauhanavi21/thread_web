# Boutique workflows

## Click and collect

1. Choose **Collect in store — pay at pickup** during checkout. Enter the collecting customer's name and contact. The order starts **reserved/unpaid**, charges no shipping, and holds the same stock used by the counter and online shop.
2. Staff find it in **Admin → Click & collect** and choose **Mark ready for pickup** after preparing the items. The customer's order page updates while open. Contact is stored for staff; no email or SMS is sent automatically.
3. At collection, staff check the order number, receive cash and hand over the items, then choose **Record payment & collection**. The order becomes **collected/paid**, records cash/change and starts its return window. Stock is not deducted a second time.
4. Customers or staff can cancel a reserved/ready unpaid hold. Uncollected holds become **expired**, releasing stock once. A cancelled or expired reservation cannot reopen as a paid order; the customer creates a new reservation if needed.

The default hold is **24 elapsed hours from reservation, including preparation time**. Staff can set 1–168 hours, address, instructions and whether new pickup reservations are available in **Site settings**. Existing reservations retain their saved deadline and location; disabling new pickup reservations does not prevent existing ones being collected.

Expiry runs at API startup, every 30 seconds while idle, and before answering API requests. A pickup cannot be collected at or after its deadline. Persisted deadlines survive a restart. Retrying an expired reservation checkout returns that original expired order without reserving stock again. Cash collection is idempotent for the same amount; conflicting repeat amounts are rejected.

Unpaid holds are excluded from revenue, best-seller totals and customer spend. Collected pickups use the same receipt, return, inspection and refund rules as other completed purchases. Deadline checks use UTC timestamps; the browser displays them in its local time zone. The bundled pickup address is fictional demo data and can be replaced in Site settings.

## One inventory for online and counter sales

Open **Admin → Counter sales**, search by product name, product slug, size or colour, and add the required variants. Enter quantities, an optional customer name, and cash received. **Record cash sale** saves the receipt, change due, staff attribution and original item prices. It records cash already handled by staff; no card reader or processor is contacted.

Counter and online purchases use the same variant stock inside a write transaction. If they compete for the last item, one succeeds. A stale counter total, insufficient cash or an unavailable line leaves the entire sale unchanged. Retrying the same counter request returns the saved receipt. Recent receipts are available after a page reload, and staff can start a return by receipt/order number.

Stock changes are broadcast as public version-only events. Connected product and catalog pages refetch stock; a customer's selected size remains selected. Connections close when a page leaves, reconnect after an interruption, and refresh on focus. The database remains the authority at checkout, including when a browser's display is stale. Notifications belong to the running API process.

Counter receipts appear in shop order/revenue totals and best sellers, but do not appear as the staff member's personal shopping history or spend. There is no counter shipping charge.

## Returns and size exchanges

1. Complete an order through **paid → processing → shipped → delivered**. Customers can then open its detail page and request a return or exchange. Staff can also enter its order number under **Admin → Returns & exchanges → Find receipt**.
2. Choose an eligible purchased line and quantity, give a reason, and, for an exchange, select another size or colour of that product. Exchange pricing stays at the original purchase price.
3. Staff approve the request. An exchange reserves its replacement at this point. If any replacement is unavailable, approval fails without reserving any of the other lines.
4. The customer brings the original item to the shop. Staff inspect every line: **Resellable** returns it to stock; **Damaged** keeps it out of stock.
5. For a return, staff acknowledge the item refund record and complete the case. For an exchange, staff hand over the reserved replacement and complete the case. Completion and retries never restock or refund twice.

The default return window is **30 days after completion**, editable under **Site settings**. Shipping is excluded from refunds. Open and completed requests consume their original purchased quantities, preventing overlapping returns. Rejected or withdrawn requests free those quantities; withdrawing or rejecting an approved exchange also releases its replacement stock.

The original order and item snapshots are preserved. Completed refunds reduce net revenue and the customer's spend; same-product exchanges do not change revenue. A sold or exchange-referenced variant cannot be renamed or deleted, preserving the meaning of its stock.

Refunds are records only: Threads does not transfer money or contact a payment provider. Returns/exchanges are processed at the shop; no return carrier or replacement shipment is created. A replacement cannot start a second return against the original purchase line. Historical delivered orders use their original creation date as a conservative return-window start because earlier releases did not store a delivery timestamp.
