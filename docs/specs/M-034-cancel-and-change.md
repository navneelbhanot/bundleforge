# M-034 — cancel + plan change

## Goal

`cancelSubscription` issues `appSubscriptionCancel`. Plan change is
implemented as a fresh `createSubscription` call (Shopify replaces the
existing charge automatically when a new one activates), with a
convenience wrapper `changePlan`.

## Acceptance

- [ ] `cancelSubscription({session, chargeId, graphql?, client?})` issues
      mutation, marks BillingSubscription `cancelled` + `cancelledAt`.
- [ ] `changePlan({session, shopId, plan, interval, returnUrl, ...})`
      delegates to createSubscription; identical contract.
- [ ] Tests with fake graphql + fake prisma.

## Files

- `src/services/billing/cancelSubscription.ts`
- `src/services/billing/cancelSubscription.test.ts`
- `src/services/billing/changePlan.ts` (thin wrapper)
