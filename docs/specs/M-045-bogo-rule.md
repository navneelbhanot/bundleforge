# M-045 — bogo rule

Buy `minQuantity` items, get `value` items free per qualifying set.
Free items are the cheapest units (merchant-safe).

## Semantics

- setSize = minQuantity + value.
- sets = floor(totalQuantity / setSize).
- totalFree = sets × value.
- discount = sum of the `totalFree` cheapest unit prices, clamped.
- BOGO does NOT use minQuantity as a gate (since the arithmetic already
  handles "not enough items"). The engine has a special-case in
  `evaluateGates` that lets minQuantity through for bogo only.

## Acceptance

- [x] Switch case for `bogo`.
- [x] Tests: 2-for-1 with mixed prices uses cheapest as free; not-enough-
      qty case returns no discount.
- [x] Fixture `08-bogo.json`.
