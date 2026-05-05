# M-006 — Express Server Scaffold + /health

## Goal

Rewrite `src/server/index.ts` so it compiles, exposes a working `/health`
endpoint that pings Postgres + Redis, and is excluded no longer from
typecheck. Wire helmet, compression, json body parsing, and a
morgan→Pino bridge. Mount the rate limiter on `/api`. Mount stub route
exports under `/api/v1/*` (the actual route handlers are upgraded in
later milestones).

## Why

Phase 1 needs a runnable server. /health is required by hosting providers
for liveness probes (Render, Fly, Railway). Wiring the middleware once
correctly keeps every route consistent.

## Out of scope

- Shopify OAuth + session middleware. M-017 / M-019.
- Real route handler implementations. They stay as stubs returning 501.
- Webhook registration. M-024.
- Listening on a TCP socket from a test — tests use `request(app)`,
  not a live socket.

## Design

```ts
// src/server/index.ts
import express, { type Express } from "express";

import { env } from "../config/env";
import { logger } from "../config/logger";
import { prisma } from "../config/database";
import { redis } from "../config/redis";
import { errorHandler } from "../middleware/errorHandler";
import { rateLimiter } from "../middleware/rateLimiter";

export function createApp(): Express {
  const app = express();
  // helmet, compression, json, morgan → Pino bridge
  // app.use("/api", rateLimiter)
  // /health
  // /api/v1/* stubs returning 501 until each route's milestone lands
  // app.use(errorHandler)
  return app;
}

export async function startServer(): Promise<void> {
  const app = createApp();
  app.listen(env.PORT, () => {
    logger.info({ port: env.PORT, nodeEnv: env.NODE_ENV }, "Server listening");
  });
}

if (require.main === module) {
  startServer().catch((err) => {
    logger.error({ err }, "Failed to start server");
    process.exit(1);
  });
}
```

`/health` semantics:

- Always responds 200 with `{ status, version, checks: { db, redis } }`.
  Per Kubernetes-style convention, "healthy" is binary; degraded
  dependencies report `false` in the relevant check field. We do NOT
  return 503 on degraded dependencies (use `/ready` for that — out of
  scope for M-006).
- Wraps each ping in a 1-second timeout; missing/slow dependencies don't
  hang the response.

Stubbed route stubs:

- The current `src/routes/*.ts` files are 3-line placeholders. Server
  attaches them under `/api/v1/<name>` if they export a `Router`; falls
  back to a 501 handler for unimplemented paths.
- `src/routes/bundles.ts` is the only one in tsconfig exclude. Skipped at
  mount time until M-053.

## Acceptance criteria

- [ ] `src/server/index.ts` removed from `tsconfig.json` exclude list.
- [ ] Typecheck + tests green.
- [ ] Tests (using supertest):
  - [ ] `GET /health` returns 200 and a JSON body with `status`,
        `version`, and `checks`.
  - [ ] `/health` JSON body includes `checks.db` and `checks.redis` keys.
  - [ ] Missing route returns 404.
  - [ ] `createApp()` is a pure factory: calling it twice produces two
        independent Express instances.
- [ ] When `NODE_ENV=test`, the server module does not auto-listen.

## Files touched

- `src/server/index.ts` (rewritten)
- `src/server/index.test.ts` (new)
- `tsconfig.json` (remove server/index.ts from exclude)

## Open questions

- The morgan→Pino bridge can wait for a follow-up; for M-006 we use
  `pino-http` directly (cleaner) once added as dep, or skip request
  logging entirely until M-007. **Decision:** add `pino-http` now; it's
  a 30 KB dep and removes the need for morgan.
