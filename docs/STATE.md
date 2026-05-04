# STATE.md — Live Project State

> Updated at the end of every session, in the same commit as the work.

---

## Current milestone

**M-008 — Rate limiter middleware + tests**

## Exact next action

Boot phase, then write `docs/specs/M-008-rate-limiter.md`. Replace
`src/middleware/rateLimiter.ts`: configurable per-shop key derivation,
in-memory limiter for tests (avoid Redis dependency), plan-aware caps
(plan registry stub if M-031 not yet done), `RateLimitError` integration.

## Blockers

None.

## Carry-overs (still active)

- Pre-existing stubs in tsconfig exclude: `src/services/bundles/index.ts`
  (M-049 will rewrite + re-include), `src/routes/bundles.ts` (M-053).
  M-006 cleared `src/server/index.ts`.
- Lint deferred to M-012.
- Broader Shopify SDK upgrade (api v13, app-express v7, prisma v6, etc.)
  flagged for ADR before M-016.
- npm audit findings (~13 moderate after pino-http + supertest) → M-140.
- `prisma/seed.ts` excluded from main tsc build; M-010 verifies it
  compiles under ts-node.

## Recently completed

- M-007 — Error handler. `docs/sessions/0007-error-handler.md`.
- M-006 — Server scaffold + /health. `docs/sessions/0006-server-scaffold.md`.
- M-005 — Redis + BullMQ. `docs/sessions/0005-redis-bullmq.md`.
- M-004 — Prisma client. `docs/sessions/0004-prisma-client.md`.
- M-003 — Pino logger. `docs/sessions/0003-logger.md`.
- M-002 — Encryption utility (AES-256-GCM). `docs/sessions/0002-encryption.md`.
- M-001 — Env validation. `docs/sessions/0001-env-bootstrap.md`.
- M-000 — Bootstrap planning system. `docs/sessions/0000-bootstrap-planning-system.md`.

## Working branch

`claude/review-product-plan-jfMlf`
