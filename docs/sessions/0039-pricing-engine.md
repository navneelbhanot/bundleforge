# Session 0039 — Pricing engine spec lock

- **Date:** 2026-05-04
- **Milestone(s):** M-039

## What was done

- `src/services/pricing/contract.ts`: canonical types — MoneyAmount,
  PricingLineItem, PricingRuleType, PricingRuleConditions, PricingRule,
  PricingContext, PricingInput, AppliedRule, PricingResult.
  PRICING_CONTRACT_VERSION = 1.
- `src/services/pricing/contract.schema.json`: JSON Schema mirror of the
  TS types. Used downstream by the Cart Transform Function fixture
  validator (M-083+).
- `tests/pricing/loadFixtures.ts`: fixture loader that both Node and
  Function tests will use (ADR-0002 — same fixtures, both runtimes).
- `tests/pricing/fixtures/.gitkeep`: empty dir; M-040+ adds the first
  fixtures.
- 2 unit tests confirming contract version + loader shape.

## ADR-0002 fulfilled

The contract is locked; M-040 onward implements rules against this exact
shape. The Cart Transform Function (M-083+) will load the same fixture
JSONs and must produce identical PricingResults.

## Acceptance

- [x] All criteria; 161 tests.

## Handoff

Next: **M-040 — Pricing rule type `fixed` + property tests**. Implement
the `fixed` rule (apply a flat total discount when min/max/conditions
match), wire `computeBundlePrice(input)` shell, add the first fixtures,
add property tests (no-op when conditions fail; never returns negative
total; deterministic for identical inputs).
