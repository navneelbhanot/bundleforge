# Session 0036 — plan caps middleware

- **Date:** 2026-05-04
- **Milestone(s):** M-036

## What was done

- `src/middleware/planCaps.ts`:
  - `loadPlanForShop` (default resolver): reads BillingSubscription;
    falls back to "starter" if no row or status != active.
  - `requirePlanFeature(feature, opts?)` middleware: 403 with code
    `feature_not_in_plan` when the resolved plan lacks the feature.
  - `enforceCap("maxBundles", opts?)` middleware: 403 with code
    `plan_cap_reached` when bundle count >= cap (null cap = unlimited).
- 6 supertest cases.

## Acceptance

- [x] All criteria; 151 tests.

## Handoff

Next: **M-037 — billing routes**. Expose REST endpoints under
`/api/v1/billing`: `GET /` (current plan + status), `POST /subscribe`
(plan + interval -> confirmationUrl), `POST /cancel`, `GET /plans` (list
caps + features). Wire to the services from M-031–M-034.
