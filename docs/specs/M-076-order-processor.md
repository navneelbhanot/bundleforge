# M-076 — Order processor: parse + extract bundle line items

## Goal

`extractBundleLineItems(payload)` walks a Shopify order webhook
payload and returns the subset of line items that look like bundles
(those carrying our metafield reference, or matched by their
shopifyProductGid).

For now we use a heuristic: line items whose `properties[]` carry a
`_bundleforge_bundle_id` key are considered bundle parents. (M-051's
publish step is what writes that property.)

## Files

- `src/services/orders/extract.ts`
- `src/services/orders/extract.test.ts`
