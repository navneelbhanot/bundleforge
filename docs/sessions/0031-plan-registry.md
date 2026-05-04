# Session 0031 — Plan registry (full)

- **Date:** 2026-05-04
- **Milestone(s):** M-031

## What was done

- `src/services/billing/plans.ts` expanded:
  - PLAN_CAPS gains `annualPriceUsd` (computed via 20% off helper) and
    `trialDays`.
  - PlanFeatures interface + PLAN_FEATURES per tier.
  - Helpers `planFeatures(name)`, `annualUsd(name)`.
- 16 unit tests covering price math, monotonic prices, monotonic
  features (higher tier ⊇ lower), gated features (3PL → pro+, headless →
  enterprise only), planFor fallback.

## Acceptance

- [x] All criteria; 135 tests, 0 lint errors.

## Handoff

Next: **M-032 — appSubscriptionCreate mutation**. GraphQL mutation that
creates a Shopify recurring application charge. Persists the resulting
`shopifyChargeId` and trial info to `BillingSubscription`. Tests use a
fake GraphQL function so we don't hit Shopify.
