# M-008 — Rate Limiter Middleware

## Goal

Replace `src/middleware/rateLimiter.ts` with a per-shop, plan-aware rate
limiter that uses Redis in production and an in-memory limiter in tests
to avoid Redis dependency for unit tests.

## Why

ARCHITECTURE.md §6 mandates 100 req/min/shop. PRODUCT_PLAN §7 differentiates
plans; higher tiers eventually deserve higher caps.

## Out of scope

- Per-route caps (e.g., bulk endpoints with lower limits).
- Plan registry implementation. We ship a small stub here at
  `src/services/billing/plans.ts`. M-031 fills it out.

## Design

```ts
// src/services/billing/plans.ts (stub for M-008)
export type PlanName = "starter" | "growth" | "pro" | "enterprise";
export const PLAN_RATE_LIMITS: Record<PlanName, { points: number; durationSec: number }>;
export function planFor(name: string | undefined): PlanName;
```

```ts
// src/middleware/rateLimiter.ts
export interface RateLimiterAdapter {
  consume(key: string, weight?: number): Promise<{ msBeforeNext: number }>;
}

export function buildRateLimiter(adapter: RateLimiterAdapter): RequestHandler;
export const rateLimiter: RequestHandler; // production default (Redis)
```

The Redis adapter wraps `RateLimiterRedis`; the memory adapter wraps
`RateLimiterMemory`. Tests inject the memory adapter.

Key derivation: prefer `req.shopDomain` (set by future shop-session
middleware), then `x-shopify-shop-domain` header (webhooks), then
`req.ip`, then `"anonymous"`.

Caps are plan-derived but the plan resolution depends on session, which
isn't wired yet. M-008 falls back to the `starter` cap for any unknown
plan; M-031 will plug in the real lookup.

## Acceptance criteria

- [ ] Typecheck + tests green.
- [ ] Tests:
  - [ ] Within-cap requests pass through.
  - [ ] Over-cap requests return 429 with `retryAfter` (number).
  - [ ] Per-key isolation: shop A's bucket does not affect shop B.
  - [ ] Real (non-rate-limit) errors propagate to next().
  - [ ] Plan resolution defaults to starter for unknown plan strings.
  - [ ] PLAN_RATE_LIMITS contains entries for all 4 plans.

## Files touched

- `src/middleware/rateLimiter.ts` (rewritten)
- `src/middleware/rateLimiter.test.ts` (new)
- `src/services/billing/plans.ts` (new — stub)
