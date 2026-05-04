# M-003 — Pino Logger

## Goal

Replace the Winston-based stub at `src/config/logger.ts` with a Pino logger
that:
- Reads level from `env.LOG_LEVEL`.
- Outputs JSON in production / test, pretty-printed in development.
- Tags every line with `service: "bundleforge"` and `version: env.APP_VERSION`.
- Exposes `logger` (root) and `child(bindings)` for module-scoped children.

## Why

ARCHITECTURE.md §1 specifies Pino. JSON logs feed Datadog (M-143).
Per-module child loggers let later milestones add structured context
(`bundleId`, `shopId`, `requestId`) without changing log call sites.

## Out of scope

- Datadog/Loki transport. M-143.
- Request-scoped log context propagation (asyncLocalStorage). Add when
  middleware needs it (M-007).
- Removing the `winston` package. Defer; not blocking.

## Design

```ts
// src/config/logger.ts
import pino, { type Logger as PinoLogger } from "pino";
import { env } from "./env";

export type Logger = PinoLogger;

const transport =
  env.NODE_ENV === "development"
    ? { target: "pino-pretty", options: { colorize: true, translateTime: "SYS:standard" } }
    : undefined;

export const logger: Logger = pino({
  level: env.LOG_LEVEL,
  base: { service: "bundleforge", version: env.APP_VERSION },
  timestamp: pino.stdTimeFunctions.isoTime,
  transport,
});
```

`logger.child({ module: "bundles" })` is the standard pattern downstream.

## Acceptance criteria

- [ ] Typecheck, test, lint (no-op) green.
- [ ] Tests:
  - [ ] Logger respects `env.LOG_LEVEL` (info-level call emits, debug-level
        suppressed when level=info).
  - [ ] Output includes `service`, `version`, `level`, `time`, and the
        message.
  - [ ] `logger.child({ x: 1 })` includes `x: 1` on emitted lines.

## Files touched

- `src/config/logger.ts` (rewritten)
- `src/config/logger.test.ts` (new)
- `package.json` (pino + pino-pretty already added in this milestone)

## Open questions

- Whether to remove `winston` now or later. Defer — keep dep, don't import.
