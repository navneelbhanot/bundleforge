# M-032 — appSubscriptionCreate

## Goal

Issue the Shopify GraphQL `appSubscriptionCreate` mutation to start a
recurring application charge for a merchant, persist the resulting
charge metadata into `BillingSubscription`, and return the confirmation
URL the merchant must visit.

## Out of scope

- Plan changes / cancellation (M-034).
- Annual billing UI (frontend, M-107). The mutation accepts an
  `interval` we set via the plan registry.

## Design

```ts
export async function createSubscription(args: {
  session: Session;
  shopId: string;
  plan: PlanName;
  interval: "monthly" | "annual";
  test?: boolean; // dev/test charge — non-billable; default NODE_ENV !== "production"
  graphql?: typeof shopifyGraphql; // DI
  client?: PrismaSubscriptionClient; // DI
}): Promise<{ confirmationUrl: string; chargeId: string }>;
```

Persists status `pending` (Shopify activates after merchant accepts).

## Acceptance

- [ ] Mutation called with the right name/price/interval/trial.
- [ ] BillingSubscription `upsert` invoked with chargeId, planName,
      interval, trialDays, status='pending', shopId.
- [ ] Returns `{confirmationUrl, chargeId}`.
- [ ] Tests inject fake graphql + fake client.

## Files

- `src/services/billing/createSubscription.ts`
- `src/services/billing/createSubscription.test.ts`
