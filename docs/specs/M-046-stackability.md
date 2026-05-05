# M-046 — stackability + priority resolution

Implemented in the engine landed in M-040. M-046 verifies the contract
with an explicit mixed-mode test.

## Rules

- Stackable rules accumulate.
- Non-stackable rules: highest `priority` wins; the rest are recorded
  in `skipped` with reason `non_stackable_lower_priority`.
- Stackable + non-stackable can coexist on the same bundle: stackables
  apply unconditionally; the non-stackable cohort resolves separately.

## Acceptance

- [x] Tests verify mixed stackable + non-stackable cohort behavior.
- [x] Skipped reason is precise (`non_stackable_lower_priority` vs
      `gate_failed`).
