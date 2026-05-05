# M-042 — Pricing rule type `flat_discount`

## Semantics

- `value` is a per-unit discount (e.g. "1.00" off each unit in cart).
- discount cents = toCents(value) × totalQuantity, clamped to subtotal.

## Acceptance

- [ ] Switch case for `flat_discount`.
- [ ] Tests: standard, gate failure, clamped at subtotal.
- [ ] Fixture `05-flat-discount.json`.
