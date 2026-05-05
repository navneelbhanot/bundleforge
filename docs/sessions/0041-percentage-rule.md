# Session 0041 — percentage rule

- **Date:** 2026-05-05
- **Milestone(s):** M-041

## What was done

- Added `percentage` case to `discountForRule` in
  `src/services/pricing/engine.ts`. Clamps value to [0, 100], floors at
  the cent, never exceeds subtotal.
- Fixture `04-percentage-single.json` (10% off $100).
- 4 engine tests (10%, 100%, >100% clamp, 0% no-op).

## Acceptance

- [x] All criteria. 192 tests pass.

## Handoff

Next: **M-042 — flat_discount rule**. Per-unit discount; discount =
toCents(value) × totalQuantity, clamped.
