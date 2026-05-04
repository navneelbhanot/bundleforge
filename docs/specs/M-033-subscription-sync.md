# M-033 — subscription status sync webhook

## Goal

Handler for Shopify `app_subscriptions/update`. Maps the payload status
onto our `BillingSubscription.status` so we always know whether a shop
is currently paying, in trial, cancelled, frozen, or expired.

## Acceptance

- [ ] Handler updates BillingSubscription by `shopifyChargeId` (the GID
      Shopify sends).
- [ ] Status normalized to lowercase (`active`, `cancelled`, `expired`,
      `frozen`, `pending`).
- [ ] If trial activates, sets `activatedAt`.
- [ ] If cancelled, sets `cancelledAt`.
- [ ] Tests with fake prisma client.

## Files

- `src/webhooks/handlers/subscriptionUpdate.ts`
- `src/webhooks/handlers/subscriptionUpdate.test.ts`
- `src/jobs/webhooksWorker.ts` (register `app_subscriptions/update`)
