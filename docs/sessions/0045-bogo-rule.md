# Session 0045 — bogo rule

Added `bogo` case: setSize = minQuantity + value; sets = floor(qty /
setSize); discount = sum of cheapest `sets × value` unit prices.
BOGO bypasses the min_quantity_not_met gate (arithmetic handles it).
Fixture `08-bogo.json`. 2 unit tests. Tests green.
