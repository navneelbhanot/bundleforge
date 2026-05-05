# Session 0008 — Rate Limiter Middleware

- **Date:** 2026-05-04
- **Milestone(s):** M-008

## What was done

- Wrote `docs/specs/M-008-rate-limiter.md`.
- New `src/services/billing/plans.ts`: stub plan registry with PLAN_CAPS,
  PLAN_RATE_LIMITS, planFor() helper. M-031 fleshes out the rest.
- Rewrote `src/middleware/rateLimiter.ts`:
  - `RateLimiterAdapter` interface — Redis (production) or Memory (test).
  - `buildRateLimiter(adapter)` factory.
  - `deriveKey(req)`: shopDomain → x-shopify-shop-domain header → IP →
    anonymous.
  - 429 response uses the M-007 error shape + Retry-After header.
  - `rateLimiter` (default export) uses Redis at starter caps; M-019/M-031
    will lift to per-shop plan resolution.
- 10 tests added: planFor, PLAN_RATE_LIMITS shape, deriveKey precedence,
  middleware happy path, over-cap 429 + retryAfter, per-shop isolation,
  non-rate-limit error propagation.

## Acceptance criteria

- [x] Typecheck + tests green (81 total).
- [x] All spec criteria pass.

## Surprises and learnings

- The previous limiter swallowed real Redis errors as 429s, masking
  connectivity problems. The new adapter splits `RateLimiterRes`
  (true rate-limit) from real errors via instanceof + next(err).

## Deferred

- Per-route caps and weighted operations (e.g., bulk imports cost more) —
  later if traffic patterns require.
- Plan resolution from session — M-019.
- Cap upgrade on plan change webhook — M-033.

## Handoff

Next: **M-009 — Initial Prisma migration applied to dev DB**. This
needs a live Postgres. With `docker-compose` not yet up (M-014), we
either need the user to provide DATABASE_URL or use Prisma's offline
migrate-diff. Strategy: run `prisma migrate dev --create-only` to
produce migration SQL files (no DB needed), commit them, document the
"actually run" step for when M-014 brings up a DB.
