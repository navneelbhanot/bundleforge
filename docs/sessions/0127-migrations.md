# Sessions 0127..0130 — Competitor migration importers

Four pure converters from competitor exports to `CreateBundleInput[]`,
each with `MigrationResult { bundles, errors[] }` so a single bad row
never aborts the batch.

- **M-127** Shopify Bundles JSON — `convertShopifyBundles(raw)`. 3
  tests (happy path, error capture, non-array input).
- **M-128** Simple Bundles JSON — `convertSimpleBundles(raw)`. 3
  tests (mix_match with rules, unknown type fallback to fixed,
  missing-name error).
- **M-129** Bundler.app CSV — `convertBundlerCsv(csv)` reuses the
  M-069 RFC-4180 parser; pipe-separated items, discount type/value.
  4 tests.
- **M-130** Kaching Bundles JSON — `convertKaching(raw)`. Volume
  offers map to a `volume` bundle with one `tiered` rule per tier;
  `bundle` offers map to `fixed`. 4 tests.

418 tests pass after this batch.
