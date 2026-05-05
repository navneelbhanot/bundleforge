# M-081..M-084 — Cart Transform Function

## Goal

Ship the Shopify Function that applies bundle pricing at checkout. Per
ADR-0002, this Function shares the canonical pricing contract with the
Node engine and is verified by the same JSON fixture set.

- **M-081 scaffold** — directory layout, `shopify.extension.toml`,
  empty `run(input)` returning `operations: []`.
- **M-082 read metafields** — `run` looks up the BundleForge metafield
  on each cart line item to find the bundle id.
- **M-083 apply pricing** — port of the Node engine into a small pure
  module the Function imports and calls.
- **M-084 cross-runtime tests** — Vitest test that imports the same
  pricing module the Function uses, runs it against every fixture in
  `tests/pricing/fixtures/`, and asserts byte-for-byte equality with
  the Node engine. The Shopify-CLI Function test runner is added later
  when a live store is provisioned.

## Files

- `extensions/cart-transform/shopify.extension.toml`
- `extensions/cart-transform/src/pricing.js`     # ported pricing
- `extensions/cart-transform/src/run.js`         # entrypoint
- `extensions/cart-transform/src/pricing.test.ts` # Vitest cross-runtime
- `extensions/cart-transform/src/run.test.ts`     # Vitest input-shape

## Wire format

The Cart Transform input shape is:
```
{
  cart: { lines: [{ id, quantity, merchandise: { id, product: { id }} , attribute: { value } }] },
  presentmentCurrencyRate: ...,
  bundleConfig: { ... }     // injected via metafields
}
```

The Function's `run` extracts a PricingInput from the cart, calls our
shared `computeBundlePrice`, and emits an `update` operation that
overrides the line price. (The Function operations API spec is
`https://shopify.dev/docs/api/functions/reference/cart-transform`.)

## Acceptance

- [ ] `extensions/cart-transform/src/pricing.js` is callable from both
      JS Function runtime and Vitest.
- [ ] Cross-runtime test loops every fixture and asserts equality with
      `computeBundlePrice` (Node engine).
- [ ] `run(input)` returns `operations: []` when no bundle line items
      are present.
- [ ] `run(input)` returns priced operations when bundle metafields
      are present.
