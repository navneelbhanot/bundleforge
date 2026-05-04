# Session 0037 — billing routes

- **Date:** 2026-05-04
- **Milestone(s):** M-037

## What was done

- Replaced `src/routes/billing.ts` stub with `installBillingRoutes(deps?)`
  factory + default `billingRoutes` singleton:
  - GET `/` — current subscription + caps + features.
  - GET `/plans` — all plans with caps + features + rate-limit budgets.
  - POST `/subscribe` — Zod-validated body `{plan, interval, returnUrl?}`
    → `{confirmationUrl, chargeId}`.
  - POST `/cancel` — looks up chargeId → cancelSubscription.
- 7 supertest cases covering all four endpoints + validation paths.

## Acceptance

- [x] All criteria; 159 tests.

## Handoff

Next: **M-038 — billing UI page** depends on the admin frontend (M-094+).
Marking M-038 deferred per PLAN.md note. Then on to **M-039 — pricing
engine spec lock + types + JSON schema** (the keystone for the Cart
Transform contract per ADR-0002).
