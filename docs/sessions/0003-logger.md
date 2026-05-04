# Session 0003 — Pino Logger

- **Date:** 2026-05-04
- **Milestone(s):** M-003
- **Branch:** claude/review-product-plan-jfMlf

## What was done

- Wrote `docs/specs/M-003-logger.md`.
- Replaced `src/config/logger.ts` (Winston) with a Pino implementation:
  - JSON in production / test, `pino-pretty` in development.
  - Level from `env.LOG_LEVEL`.
  - Base bindings: `service: "bundleforge"`, `version: env.APP_VERSION`.
  - ISO-time timestamps.
- Added `src/config/logger.test.ts` (5 tests): singleton import, level
  filtering, base bindings, child bindings.
- Added `pino@^9.14.0` and `pino-pretty@^11.3.0` to `package.json`.
- **Boot-phase reconciliation**: Pino's API is `(obj, msg)` not Winston's
  `(msg, obj)`. Fixed four call sites that broke typecheck:
  - `src/middleware/errorHandler.ts` (two calls)
  - `src/jobs/worker.ts` (two calls)
  - `src/config/redis.ts` (two calls)
  - `src/config/database.ts` (one call)

## Acceptance criteria

- [x] Typecheck, test green. Lint no-op.
- [x] All three logger tests in the spec pass; two extra cases added
      (singleton import, level=debug emission).

## Verified by hand

- 44 tests passing total (19 env + 20 enc + 5 logger).

## Deferred

- Removing the `winston` dep. Defer; nothing imports it anymore.
- AsyncLocalStorage request-scoped context for request IDs — wait until
  M-007 hardens the error handler.

## Handoff

Next: **M-004 — Prisma client init + connection pooling**. Replace the
stub `src/config/database.ts` with a properly-typed PrismaClient singleton,
slow-query log via Pino, graceful disconnect, and a `connectDatabase`
helper. Test with a mock client (no live DB needed).
