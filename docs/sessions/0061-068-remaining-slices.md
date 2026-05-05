# Sessions 0061..0068 — remaining vertical slices

Eight slice tests added, one per remaining bundle type:

- BXGY (M-061): mixed-price lines, bogo rule, $10 off across 2 sets.
- Build-a-box (M-062): 4-step picker, 25% off when min met.
- Subscription (M-063): type tag + fixed discount; Recharge wires later.
- Gift (M-064): 100% off → total = 0.
- Mystery (M-065): $10 fixed discount.
- Sample (M-066): tag-gated 100% off for "new-customer".
- Wholesale (M-067): minWholesaleQuantity config + volume rule.
- Custom (M-068): engine returns zero for unknown rule types (graceful
  fallback, not a throw).

275 tests pass. **Closes Phase F (M-056..M-068).**
