# STATE.md — Live Project State

> Updated at the end of every session, in the same commit as the work.

---

## Current milestone

**M-003 — Logger config (pino) + structured logging**

## Exact next action

Boot phase, then write `docs/specs/M-003-logger.md`, replace
`src/config/logger.ts` (currently Winston-based) with a Pino logger that
honors `env.LOG_LEVEL`, JSON in production, pretty in dev. Add tests.

## Blockers

None.

## Carry-overs (still active)

Same as M-002 close: pre-existing stubs in tsconfig exclude (M-006, M-049,
M-053), lint deferred to M-012, broader Shopify SDK upgrade flagged for
ADR before M-016, npm audit findings to M-140, prisma seed.ts excluded
from main tsc build (M-010 verifies).

## Recently completed

- M-002 — Encryption utility (AES-256-GCM). `docs/sessions/0002-encryption.md`.
- M-001 — Env validation. `docs/sessions/0001-env-bootstrap.md`.
- M-000 — Bootstrap planning system. `docs/sessions/0000-bootstrap-planning-system.md`.

## Working branch

`claude/review-product-plan-jfMlf`
