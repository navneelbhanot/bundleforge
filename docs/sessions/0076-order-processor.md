# Sessions 0076..0077 — Order processor + SKU breakdown

- `src/services/orders/extract.ts` (M-076) —
  `extractBundleLineItems(order)` returns `{bundleId, lineItem}` pairs
  for line items carrying the `_bundleforge_bundle_id` property. The
  bundle service's `publish` (M-051) is what sets that property when
  the contract is finalized in a future milestone. 3 unit tests.
- `src/services/orders/skuBreakdown.ts` (M-077) — pure
  `breakdownBundleSkus(items, bundlesSold)` returns a flat array of
  `{sku, gid, variantGid, title, quantity}` lines. 3 unit tests.

306 tests pass.
