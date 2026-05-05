# M-041 — Pricing rule type `percentage`

## Goal

Add `percentage` to `discountForRule` in `src/services/pricing/engine.ts`.

## Semantics

- `value` is a percent string in [0, 100], e.g. "10" or "15.50".
- discount cents = floor((subtotal × percent) / 100), clamped to subtotal.
- All gate/stack mechanics inherited from M-040.

## Acceptance

- [ ] Switch case for `percentage` in `discountForRule`.
- [ ] Tests: 10% off subtotal, 100% (= subtotal), gate failure.
- [ ] Fixture `04-percentage-single.json`.
