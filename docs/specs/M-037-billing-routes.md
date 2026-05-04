# M-037 — billing routes

## Endpoints

- `GET /api/v1/billing` — current BillingSubscription + plan caps + features.
- `GET /api/v1/billing/plans` — list of all plans (caps + features).
- `POST /api/v1/billing/subscribe` body `{ plan, interval }` →
  `{ confirmationUrl }`.
- `POST /api/v1/billing/cancel` → `{ status }`.

All require `req.shopId` (mounted ahead via M-019).

## Acceptance

- [ ] Routes use Zod-validated body / query.
- [ ] Subscribe accepts `plan ∈ growth|pro|enterprise`, `interval ∈ monthly|annual`.
- [ ] Cancel reads chargeId from BillingSubscription.
- [ ] Tests with supertest + injected createSubscription/cancelSubscription.

## Files

- `src/routes/billing.ts` (rewrite stub)
- `src/routes/billing.test.ts` (new)
