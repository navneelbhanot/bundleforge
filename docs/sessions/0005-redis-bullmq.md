# Session 0005 — Redis + BullMQ

- **Date:** 2026-05-04
- **Milestone(s):** M-005

## What was done

- Wrote `docs/specs/M-005-redis-bullmq.md`.
- `src/config/redis.ts`: ioredis singleton wired for BullMQ
  (`maxRetriesPerRequest: null`, `enableReadyCheck: false`, `lazyConnect`),
  `connectRedis` / `disconnectRedis`, pure `backoffMs` helper.
- `src/jobs/queues.ts` (new): single source of `ORDER_QUEUE` /
  `INVENTORY_QUEUE` constants and Queue instances.
- `src/jobs/worker.ts`: rewritten to import queues from the new module,
  use Pino child logger, drop `as any` casts, and reference future
  milestone numbers in TODOs.

## Acceptance criteria

- [x] Typecheck + tests green (53 total).
- [x] backoffMs: starts at base, monotonic, capped, handles negatives.
- [x] redis status valid pre-connect.

## Deferred

- Live Redis integration test in M-014 (docker-compose) once the dev
  environment has a real Redis to talk to.

## Handoff

Next: **M-006 — Express server scaffold + /health + tests**. Harden
`src/server/index.ts` (currently in tsconfig exclude). Wire env, helmet,
compression, morgan→Pino, the rate limiter, route stubs, and a /health
endpoint that ping-checks DB and Redis. Re-include the file in tsconfig
once it compiles.
