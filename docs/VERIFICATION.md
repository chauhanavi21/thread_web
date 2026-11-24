# Order workflow verification

Verified locally on 23 November 2026 with Node 24.22.1, SQLite, and Chromium. All customers, addresses, products, and credentials used by the tests are fictional. The test runners create temporary databases; the store's normal database is not used.

| Check | Result | Scope |
| --- | --- | --- |
| `cd backend; npm test` | 54 passed | Real HTTP/SQLite order, counter, pickup, expiry, return, exchange, and refund workflows |
| `cd frontend; npm run build` | Passed | Production frontend bundle |
| `cd frontend; npm run test:e2e` | 16 passed | Eight workflows each at desktop and phone viewports in Chromium |

The API tests verify server-owned pricing and shipping, immutable price/name snapshots, merged quantity limits, multi-line failure rollback, competing purchases of the last unit, simultaneous retry deduplication, and replay from a separate server process. Retry keys are scoped to a customer and reject changed request contents. Failed checkouts do not consume their key.

Cancellation tests verify ownership, cancellation before dispatch, repeated cancellation, forward-only fulfillment, stock checks when reopening, rollback when a later item cannot be restocked into an order, and dispatch racing cancellation. Replaying an old checkout returns its current cancelled state without reserving stock again.

Return/exchange tests cover partial quantities, original-price refunds, overlapping requests, ownership, return windows, idempotent requests/actions, replacement reservation and release, multi-line rollback, damaged-item inspection, and net revenue. Browser checks follow a customer size exchange through staff approval and inspection, then complete a damaged return and verify both stock counts and the refund record.

Counter tests verify cash/change, price freshness, staff access, receipt deduplication, online/counter competition for the last unit, counter returns, and committed inventory events. The browser keeps a customer product page open while staff record a cash sale, verifies the stock count updates without reloading or losing the selected size, and reloads the staff page to recover the receipt.

Revoking staff access is also tested against customer-facing routes: internal counter receipts and their return cases cannot be accessed as the former staff member's own purchases.

Pickup tests verify unpaid inventory holds, zero shipping, cash-at-collection, legal status changes, replay safety, exact-deadline expiry, repeated release, automatic expiry before ordinary reads, restart recovery, reservation policy snapshots, protected contact data, return eligibility after collection, and three-way contention for the last unit. Tests pass explicit times or persisted past deadlines; they do not sleep for a hold to expire. Browser checks lose a committed reservation response and retry after reload, then use separate customer/staff contexts to verify live readiness and collection. A second workflow edits pickup settings and cancels an unpaid hold.

The browser suite signs up a real account and buys a product through the storefront. It deliberately loses the response after the order commits, reloads checkout, and verifies that retrying produces one saved order and one stock deduction. It also covers stock errors, confirming or declining cancellation, cancellation persistence after reload, and dispatch while the cancellation confirmation is open. The staff selector is checked against the server's legal next statuses.

GitHub Actions runs API tests on Ubuntu and Windows with Node 24, and the production build and browser suite on Ubuntu. Check the workflow run attached to each pull request for its result.

## Limits

- Phone tests use viewport/device emulation in Chromium, not a physical phone or Safari.
- Shipping checkout payments are simulated. Cash and refund entries are manual records. No payment processor, refund service, carrier, cloud deployment, real sales, or customer demand was verified.
- The tests exercise the local application. They are not a production load test or an accessibility certification.
- The business score remains an estimate of a clothing business. Engineering checks support a higher implementation-completeness rating; they do not establish better demand, margins, retention, or acquisition costs.
