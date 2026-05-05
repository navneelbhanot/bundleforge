# M-078..M-080 — Order webhook handlers

Three webhook handlers wired into the M-026 registry:

- **M-078 `orders/create`** — extracts bundle line items, writes a
  `BundleOrder` per bundle, calls `applyAdjustment(delta=-qty)` per
  bundle to consume inventory, writes the SKU breakdown.
- **M-079 `orders/cancelled`** — reverses the inventory adjustments
  (delta=+qty) for any associated `BundleOrder` rows; sets status
  `cancelled`.
- **M-080 `orders/updated`** — handles partial fulfillment / refunds
  by syncing fulfillmentStatus and (on full refund) reversing
  inventory.

Real Shopify Inventory API calls are stubbed in this milestone — the
inventory engine still updates `inventory_sync_state`, but the
outbound `inventoryAdjustQuantities` GraphQL mutation is added when a
live store is wired up.

## Files

- `src/webhooks/handlers/ordersCreate.ts` (M-078)
- `src/webhooks/handlers/ordersCancelled.ts` (M-079)
- `src/webhooks/handlers/ordersUpdated.ts` (M-080)
- Tests for each.
- `src/jobs/webhooksWorker.ts` registers all three.
