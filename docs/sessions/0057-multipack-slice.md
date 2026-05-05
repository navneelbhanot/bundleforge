# Session 0057 — multipack vertical slice

`tests/slices/multipack.test.ts` — multipack with packQuantity=6, prices
6 × $2 with 15% off → $10.20. Also asserts the per-type validator
rejects multipack without packQuantity. 2 cases.
