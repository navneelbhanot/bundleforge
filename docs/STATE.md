# STATE.md — Live Project State

> Updated at the end of every session, in the same commit as the work.

---

## Current milestone

**M-005 — Redis + BullMQ client init**

## Exact next action

Boot phase, then write `docs/specs/M-005-redis-bullmq.md`, replace
`src/config/redis.ts` with typed ioredis singleton, lifecycle helpers, pure
backoff helper. Create `src/jobs/queues.ts` with named queue definitions
(`orderQueue`, `inventoryQueue`) for downstream milestones to import.

## Blockers

None.

## Carry-overs (still active)

Same as M-002 close: pre-existing stubs in tsconfig exclude (M-006, M-049,
M-053), lint deferred to M-012, broader Shopify SDK upgrade flagged for
ADR before M-016, npm audit findings to M-140, prisma seed.ts excluded
from main tsc build (M-010 verifies).

## Recently completed

- M-004 — Prisma client. `docs/sessions/0004-prisma-client.md`.
- M-003 — Pino logger. `docs/sessions/0003-logger.md`.
- M-002 — Encryption utility (AES-256-GCM). `docs/sessions/0002-encryption.md`.
- M-001 — Env validation. `docs/sessions/0001-env-bootstrap.md`.
- M-000 — Bootstrap planning system. `docs/sessions/0000-bootstrap-planning-system.md`.

## Working branch

`claude/review-product-plan-jfMlf`
