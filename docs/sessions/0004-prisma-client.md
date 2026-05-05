# Session 0004 — Prisma Client

- **Date:** 2026-05-04
- **Milestone(s):** M-004

## What was done

- Wrote `docs/specs/M-004-prisma-client.md`.
- Replaced `src/config/database.ts` with PrismaClient singleton:
  - Event-based logging for query/error/warn, routed to a `module: "db"`
    Pino child.
  - Slow-query warn extracted into pure `shouldLogSlowQuery()` for
    testability; threshold 500ms.
  - `connectDatabase()` / `disconnectDatabase()` lifecycle helpers.
- Added `src/config/database.test.ts` (4 tests): import safety + slow-query
  threshold semantics.
- **Boot-phase improvement**: added `tests/setup.ts` and wired it into
  `vitest.config.ts` `setupFiles`. Required because logger and database
  read env at module-load time; tests need a valid env populated before
  imports resolve.

## Acceptance criteria

- [x] Typecheck + tests green (48 total).
- [x] Module exports `prisma`, `connectDatabase`, `disconnectDatabase`.
- [x] Slow-query handler tested at boundary (≤500 vs >500).

## Deferred

- Live-DB integration tests: M-009 (after migration is applied).
- Connection pool sizing tuning: M-014/M-145 (load test + ops).

## Handoff

Next: **M-005 — Redis + BullMQ**. Replace `src/config/redis.ts` with a
typed ioredis singleton, lifecycle helpers, and a pure helper for retry
backoff. Add a `src/jobs/queues.ts` that defines the BullMQ queues used
later (orderQueue, inventoryQueue) so M-006+ can import them cleanly.
