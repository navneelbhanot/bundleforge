# Sessions 0078..0080 — Order webhook handlers

- `src/webhooks/handlers/ordersCreate.ts` (M-078) — for each
  bundle-marked line item, persists a `BundleOrder` (with snapshot
  + skuBreakdown) and calls `applyAdjustment(delta=-qty)` when the
  bundle has inventoryItemGid + locationGid wired. Hostile branches
  (no shop, unknown bundle, missing items) are logged and skipped —
  never throw past the registry, so a single bad order doesn't poison
  the queue. 4 vi.fn() tests.
- `src/webhooks/handlers/ordersCancelled.ts` (M-079) — reverses
  inventory (`delta=+qty`) for any associated `BundleOrder` rows;
  marks status='cancelled'. 2 tests.
- `src/webhooks/handlers/ordersUpdated.ts` (M-080) — maps
  `fulfillment_status` (fulfilled / partial / unfulfilled) onto
  `BundleOrder.fulfillmentStatus`; marks `status='fulfilled'` on full
  fulfillment. 4 tests.

All three registered in `src/jobs/webhooksWorker.ts`.

316 tests pass total. **Closes M-061..M-080 target.**
