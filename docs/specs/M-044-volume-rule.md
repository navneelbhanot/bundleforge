# M-044 — volume rule

Per-unit discount applied only to units AT or beyond the threshold
(`minQuantity`).

## Semantics

- `value` is a per-unit money amount.
- qualifying = max(0, totalQuantity - minQuantity + 1).
- discount cents = toCents(value) × qualifying, clamped.
- minQuantity gate still applies (skipped if not met).

## Acceptance

- [x] Switch case for `volume`.
- [x] Tests: at/above threshold, below threshold (skipped).
- [x] Fixture `07-volume.json`.
