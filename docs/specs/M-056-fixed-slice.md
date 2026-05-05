# M-056..M-060 — Vertical slices (current-layer scope)

## Goal

For each of the next 5 bundle types (fixed, multipack, volume,
mix_match, bogo), wire an integration test that exercises every layer
that exists today:

1. `BundleService.create` with the right config + items + rules.
2. Convert the persisted Bundle into a `PricingInput`.
3. `computeBundlePrice` returns the expected price.
4. `BundleService.publish` flips status to active.
5. `BundleService.softDelete` cleans up.

Layers not yet built (Cart Transform Function, order processing, SKU
breakdown, analytics, admin UI) will be added to these slice tests as
their milestones (M-076+, M-083+, M-094+) land.

## Helper

`tests/slices/buildPricingInput.ts` — pure conversion from
`{items, pricingRules, currency, context}` into `PricingInput`. Used by
all 5 slice tests.

## Files

- `tests/slices/buildPricingInput.ts`
- `tests/slices/fixed.test.ts` (M-056)
- `tests/slices/multipack.test.ts` (M-057)
- `tests/slices/volume.test.ts` (M-058)
- `tests/slices/mix-match.test.ts` (M-059)
- `tests/slices/bogo.test.ts` (M-060)
