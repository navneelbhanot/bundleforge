# Session 0033 — subscription sync webhook

- **Date:** 2026-05-04
- **Milestone(s):** M-033

## What was done

- `src/webhooks/handlers/subscriptionUpdate.ts`: maps payload status
  (active/declined/cancelled/canceled/expired/frozen/pending) onto
  BillingSubscription. Sets `activatedAt` on activation, `cancelledAt`
  on cancellation. updateMany by shopifyChargeId.
- 4 tests; registered as `app_subscriptions/update` in webhooksWorker.

## Acceptance

- [x] All criteria; 143 tests.

## Handoff

Next: **M-034 — cancel + plan change**. `cancelSubscription(args)` calls
`appSubscriptionCancel`. Plan-change is just `createSubscription` for
the new plan; Shopify replaces the existing one. Wraps the same DI shape.
