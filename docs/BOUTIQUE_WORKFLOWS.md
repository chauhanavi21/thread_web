# Boutique workflows

## Returns and size exchanges

1. Complete an order through **paid → processing → shipped → delivered**. Customers can then open its detail page and request a return or exchange. Staff can also enter its order number under **Admin → Returns & exchanges → Find receipt**.
2. Choose an eligible purchased line and quantity, give a reason, and, for an exchange, select another size or colour of that product. Exchange pricing stays at the original purchase price.
3. Staff approve the request. An exchange reserves its replacement at this point. If any replacement is unavailable, approval fails without reserving any of the other lines.
4. The customer brings the original item to the shop. Staff inspect every line: **Resellable** returns it to stock; **Damaged** keeps it out of stock.
5. For a return, staff acknowledge the item refund record and complete the case. For an exchange, staff hand over the reserved replacement and complete the case. Completion and retries never restock or refund twice.

The default return window is **30 days after completion**, editable under **Site settings**. Shipping is excluded from refunds. Open and completed requests consume their original purchased quantities, preventing overlapping returns. Rejected or withdrawn requests free those quantities; withdrawing or rejecting an approved exchange also releases its replacement stock.

The original order and item snapshots are preserved. Completed refunds reduce net revenue and the customer's spend; same-product exchanges do not change revenue. A sold or exchange-referenced variant cannot be renamed or deleted, preserving the meaning of its stock.

Refunds are records only: Threads does not transfer money or contact a payment provider. Returns/exchanges are processed at the shop; no return carrier or replacement shipment is created. A replacement cannot start a second return against the original purchase line. Historical delivered orders use their original creation date as a conservative return-window start because earlier releases did not store a delivery timestamp.
