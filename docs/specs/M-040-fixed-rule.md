# M-040 — Pricing rule: `fixed`

## Goal

Implement `computeBundlePrice(input): PricingResult` and the first rule
type, `fixed` (a flat total discount applied when gates pass). Lock in
the engine skeleton so M-041..M-045 plug in additional rule types.

## Why

This is the first behavioral piece of the pricing engine. Per ADR-0002
the JSON fixtures in `tests/pricing/fixtures/` will become the
regression suite shared with the Cart Transform Function (M-083+).

## Out of scope

- Other rule types (M-041..M-045).
- Currency conversion across line items (require single currency).
- Rounding modes other than banker's rounding to the cent.

## Design

`src/services/pricing/money.ts` — small helper:
```ts
toCents(amount: string): number;        // "12.50" -> 1250
fromCents(cents: number, ccy): MoneyAmount;
sumLineItems(items): { cents, currencyCode };
```

`src/services/pricing/engine.ts`:
```ts
export function computeBundlePrice(input: PricingInput): PricingResult;
```

Algorithm:

1. Validate single currency across line items (throw on mismatch).
2. subtotal = Σ unit_cents × qty.
3. For each rule:
   - Evaluate gates: minQuantity (sum of qty across line items),
     maxQuantity, minCartValue (subtotal), conditions
     (startsAt/endsAt/customerTags/countries vs context).
   - If gate fails → skipped("gate_failed").
4. Among passing rules, partition stackable vs non-stackable.
5. Non-stackable: pick the one with highest priority; the rest go to
   skipped("non_stackable_lower_priority"). The chosen one applies.
6. Stackable: all apply.
7. For each applied rule, compute discount in cents:
   - `fixed`: cents = toCents(rule.value) — clamped to ≥ 0.
8. totalDiscount = Σ applied discounts; clamp at subtotal so total ≥ 0.
9. total = subtotal − totalDiscount.

## Acceptance criteria

- [ ] Typecheck + tests green.
- [ ] Unit tests:
  - [ ] toCents handles "0", "0.00", "12", "12.5", "12.50",
        "12.345" (round half to even).
  - [ ] fromCents roundtrips at integer cents.
- [ ] Engine tests:
  - [ ] No rules → discount 0, total = subtotal.
  - [ ] Single fixed rule, gates pass → applies.
  - [ ] minQuantity gate fails → skipped, no discount.
  - [ ] minCartValue gate fails → skipped.
  - [ ] customerTags condition AND date window: failing date → skipped.
  - [ ] Two fixed stackable rules → both apply.
  - [ ] Two fixed non-stackable rules → highest priority wins; lower
        skipped("non_stackable_lower_priority").
  - [ ] Discount > subtotal → total clamped to 0, totalDiscount =
        subtotal.
- [ ] Fixture-driven test loops over `tests/pricing/fixtures/*.json`
      and asserts engine output equals `expected` for each.
- [ ] At least 3 fixtures committed (no rules; one fixed; two stackable
      fixed).

## Files

- `src/services/pricing/money.ts`
- `src/services/pricing/money.test.ts`
- `src/services/pricing/engine.ts`
- `src/services/pricing/engine.test.ts`
- `tests/pricing/fixtures/01-no-rules.json`
- `tests/pricing/fixtures/02-fixed-single.json`
- `tests/pricing/fixtures/03-fixed-stackable.json`
