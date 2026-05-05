# M-043 — tiered rule

`tiered` rules express percentage-off at quantity thresholds. Multiple
tiered rules with different `minQuantity` and `priority` are typically
non-stackable; the engine selects the highest-priority qualifying tier
(M-040 mechanics).

## Semantics

- `value` is a percent string (0–100).
- discount cents = floor(subtotal × value / 100), clamped.
- Selection of the right tier is the existing non-stackable + priority
  cascade (M-040).

## Acceptance

- [x] Switch case for `tiered` (shares percentage arithmetic).
- [x] Test: 3-tier ladder with qty=6 picks the priority-2 tier.
- [x] Fixture `06-tiered.json`.
