# Session 0034 — cancel + plan change

- **Date:** 2026-05-04
- **Milestone(s):** M-034 (also closes M-035 which was rolled into M-031)

## What was done

- `src/services/billing/cancelSubscription.ts`: issues
  `appSubscriptionCancel`, marks BillingSubscription cancelled +
  cancelledAt. Throws on userErrors.
- `src/services/billing/changePlan.ts`: thin wrapper around
  createSubscription (Shopify replaces existing charge automatically).
- 2 tests for cancellation; M-032 already exercises the upsert path.
- M-035 (Annual billing 20%) was already implemented as part of M-031's
  PLAN_CAPS / annualUsd helper. Marked done with a roll-up note in
  PLAN.md.

## Acceptance

- [x] All criteria; 145 tests.

## Handoff

Next: **M-036 — plan caps middleware**. `requirePlanFeature(name)` and
`enforceCap('maxBundles' | 'maxOrdersPerMonth')` middleware that read
`req.shopId` (from M-019) and the BillingSubscription / order count.
Returns ForbiddenError when over cap.
