# M-048 — per-type bundle config validators (Zod)

## Goal

Per-type Zod schemas for `Bundle.config`. A discriminated union keyed by
`type` so the bundle service (M-049) can validate config payloads
deterministically per bundle type.

## Bundle types

`fixed`, `mix_match`, `bogo`, `bxgy`, `volume`, `build_box`,
`multipack`, `gift`, `mystery`, `sample`, `subscription`, `wholesale`,
`custom`.

## Per-type config

| Type | Config fields |
|------|---------------|
| fixed | (none required) |
| mix_match | minItems, maxItems, allowDuplicates? |
| bogo, bxgy | (none — wired via pricing rules) |
| volume | (none — wired via pricing rules) |
| build_box | minItems, maxItems, allowDuplicates?, steps?[] |
| multipack | packQuantity |
| gift | (free-form metadata) |
| mystery, sample | (free-form metadata) |
| subscription | (free-form; integration owns the rest) |
| wholesale | minWholesaleQuantity? |
| custom | (free-form) |

## Files

- `src/services/bundles/validators.ts`
- `src/services/bundles/validators.test.ts`
