# M-127..M-130 — Competitor migration importers

Each importer turns a competitor's export format into
`CreateBundleInput[]` so it can flow through `BundleService.create`.

- **M-127 Shopify Bundles** — input is the Shopify Admin API "bundle"
  product type JSON. Map components → items.
- **M-128 Simple Bundles** — input is Simple Bundles' bundle export
  (JSON with `bundleType`, `components[]`, `pricingRules[]`).
- **M-129 Bundler.app** — Bundler's CSV export (one row per bundle,
  pipe-separated items).
- **M-130 Kaching Bundles** — Kaching's JSON export.

All four converters are **pure functions** so tests don't need fixtures
on disk; the test files include inline samples. The importers all live
under `src/services/bundles/migrations/`.

## Files

- `src/services/bundles/migrations/types.ts`
- `src/services/bundles/migrations/shopifyBundles.ts` (+ test)
- `src/services/bundles/migrations/simpleBundles.ts` (+ test)
- `src/services/bundles/migrations/bundler.ts` (+ test)
- `src/services/bundles/migrations/kaching.ts` (+ test)
