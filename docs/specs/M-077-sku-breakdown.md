# M-077 — SKU breakdown

## Goal

Given a bundle's items + a quantity sold, produce the per-SKU breakdown
that downstream 3PL/WMS integrations consume. Pure function.

```ts
breakdownBundleSkus(bundleItems, quantitySold) -> [{ sku, gid, quantity }]
```

Each item's `quantity * sold` becomes the breakdown line.
