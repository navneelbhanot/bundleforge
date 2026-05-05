# M-061..M-068 — Remaining vertical slices

Bundle types covered:

- **M-061 BXGY** — buy X, get Y (different SKUs). For now uses the
  `bogo` rule with a per-line discriminator.
- **M-062 build-a-box** — multi-step picker with `steps` config. Pricing
  via percentage rule with `minQuantity`.
- **M-063 subscription bundle** — type tag only; Recharge/Bold/Seal
  integration arrives at M-119+. Slice asserts the bundle creates and
  prices like a fixed bundle.
- **M-064 gift** — free bundle (price=0 or 100% off rule).
- **M-065 mystery** — opaque contents; pricing is just a fixed rule.
- **M-066 sample** — same shape as gift, often $0 or low fixed price.
- **M-067 wholesale** — minWholesaleQuantity gate; volume-style pricing.
- **M-068 custom** — free-form config; ensures the engine handles
  unknown rule types gracefully (returns 0 discount, not an error).

Each slice mirrors the M-056..M-060 pattern: vi.mocked repo,
`buildPricingInput` helper, assert `computeBundlePrice` output.

## Files

- `tests/slices/bxgy.test.ts` (M-061)
- `tests/slices/build-box.test.ts` (M-062)
- `tests/slices/subscription.test.ts` (M-063)
- `tests/slices/gift.test.ts` (M-064)
- `tests/slices/mystery.test.ts` (M-065)
- `tests/slices/sample.test.ts` (M-066)
- `tests/slices/wholesale.test.ts` (M-067)
- `tests/slices/custom.test.ts` (M-068)
