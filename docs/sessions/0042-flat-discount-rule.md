# Session 0042 — flat_discount rule

- **Date:** 2026-05-05
- **Milestone(s):** M-042

## What was done

- engine.ts: added `flat_discount` case (per-unit × totalQuantity, clamped).
- engine.test.ts: 2 cases (standard, clamped at subtotal).
- Fixture `05-flat-discount.json`.

## Acceptance

- [x] All criteria. Tests green.
