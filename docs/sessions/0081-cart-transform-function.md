# Sessions 0081..0084 — Cart Transform Function

The keystone of ADR-0002 lands. The Function ships as plain JS so the
Shopify Function runtime loads it without a build step, and a Vitest
parity test asserts byte-for-byte equality with the Node engine for
every fixture in `tests/pricing/fixtures/`.

- `extensions/cart-transform/shopify.extension.toml` — extension config
- `extensions/cart-transform/src/run.graphql` — input query
- `extensions/cart-transform/src/pricing.js` — pricing engine port
- `extensions/cart-transform/src/run.js` — entry; reads cart-line
  attribute markers, distributes the discount across lines, emits
  `update` operations
- `extensions/cart-transform/src/pricing.test.ts` — cross-runtime
  parity test (8 fixtures)
- `extensions/cart-transform/src/run.test.ts` — input-shape tests
  (3 cases)

vitest config and tsconfig updated to recognize the `extensions/` tree
(allowJs + rootDirs).

327 tests pass.
