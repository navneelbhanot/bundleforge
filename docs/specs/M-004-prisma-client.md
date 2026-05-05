# M-004 — Prisma Client Init + Connection Pooling

## Goal

Replace `src/config/database.ts` with a typed PrismaClient singleton wired
to the Pino logger, with `connectDatabase()` / `disconnectDatabase()`
helpers and a slow-query warning at >500ms.

## Why

Every service in `src/services/<domain>/` will import `prisma` from this
module. Singleton (not per-request) avoids connection-pool exhaustion.
Prisma manages its own pool sized via `DATABASE_URL` (Postgres
`?connection_limit=N`).

## Out of scope

- Migrations (M-009).
- Prisma Accelerate / read replicas.
- Multi-tenant connection partitioning.

## Design

```ts
// src/config/database.ts
import { PrismaClient } from "../generated/prisma";
import { logger } from "./logger";

const dbLogger = logger.child({ module: "db" });

export const prisma = new PrismaClient({
  log: [
    { level: "query", emit: "event" },
    { level: "error", emit: "event" },
    { level: "warn", emit: "event" },
  ],
});

prisma.$on("query", (e) => {
  if (e.duration > 500) dbLogger.warn({ ms: e.duration, sql: e.query }, "Slow query");
});
prisma.$on("error", (e) => dbLogger.error({ msg: e.message }, "Prisma error"));
prisma.$on("warn", (e) => dbLogger.warn({ msg: e.message }, "Prisma warn"));

export async function connectDatabase(): Promise<void> {
  await prisma.$connect();
  dbLogger.info("Database connected");
}

export async function disconnectDatabase(): Promise<void> {
  await prisma.$disconnect();
  dbLogger.info("Database disconnected");
}
```

## Acceptance criteria

- [ ] Typecheck and tests green.
- [ ] Module exports `prisma`, `connectDatabase`, `disconnectDatabase`.
- [ ] Tests:
  - [ ] Module imports without throwing.
  - [ ] Slow-query handler emits a warn entry above 500ms (mock the
        Prisma `$on` plumbing).
  - [ ] Slow-query handler does NOT emit at ≤500ms.
  - [ ] `connectDatabase` calls `$connect`; `disconnectDatabase` calls
        `$disconnect`.

## Files touched

- `src/config/database.ts`
- `src/config/database.test.ts` (new)

## Open questions

- Vitest cannot easily mock the Prisma client's `$on` typed events. Tests
  isolate the slow-query handler logic into a small pure function so it can
  be tested without a live `PrismaClient`.
