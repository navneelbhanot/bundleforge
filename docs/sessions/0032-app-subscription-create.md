# Session 0032 — appSubscriptionCreate

- **Date:** 2026-05-04
- **Milestone(s):** M-032

## What was done

- `src/services/billing/createSubscription.ts`: issues the
  `appSubscriptionCreate` GraphQL mutation; persists
  `{shopifyChargeId, planName, interval, status:'pending', trialDays,
  trialEndsAt}` via upsert. Returns `{confirmationUrl, chargeId}` for the
  caller to redirect to. DI for both graphql + prisma client.
- 4 tests: monthly + annual paths, userErrors path, starter rejection.

## Acceptance

- [x] All criteria; 139 tests.

## Handoff

Next: **M-033 — subscription status sync webhook**.
`app_subscriptions/update` payload reflects activation, cancellation,
expiry. Map status → BillingSubscription. Register handler.
