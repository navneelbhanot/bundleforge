# STATE.md — Live Project State

> Updated at the end of every session, in the same commit as the work.

---

## Current milestone

**M-004 — Prisma client init + connection pooling**

## Exact next action

Boot phase, then write `docs/specs/M-004-prisma-client.md`, replace
`src/config/database.ts` with a typed PrismaClient singleton with slow-query
logging via Pino, graceful disconnect, and `connectDatabase()` helper.
Tests use Prisma's mock-extended client; no live DB required.

## Blockers

None.

## Carry-overs (still active)

Same as M-002 close: pre-existing stubs in tsconfig exclude (M-006, M-049,
M-053), lint deferred to M-012, broader Shopify SDK upgrade flagged for
ADR before M-016, npm audit findings to M-140, prisma seed.ts excluded
from main tsc build (M-010 verifies).

## Recently completed

- M-003 — Pino logger. `docs/sessions/0003-logger.md`.
- M-002 — Encryption utility (AES-256-GCM). `docs/sessions/0002-encryption.md`.
- M-001 — Env validation. `docs/sessions/0001-env-bootstrap.md`.
- M-000 — Bootstrap planning system. `docs/sessions/0000-bootstrap-planning-system.md`.

## Working branch

`claude/review-product-plan-jfMlf`
