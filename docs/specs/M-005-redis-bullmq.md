# M-005 — Redis + BullMQ Init

## Goal

Replace `src/config/redis.ts` with a typed ioredis singleton, lifecycle
helpers, and a pure backoff function. Add `src/jobs/queues.ts` with named
queues for use by future workers and route handlers.

## Why

BullMQ requires a long-lived ioredis connection. Multiple Queue instances
share one connection. Defining queue *names* + queue *instances* in a
single module avoids duplicated `new Queue(...)` calls scattered across
files (which causes connection storms).

## Out of scope

- Worker process startup (lives at `src/jobs/worker.ts`, kept as stub
  through M-077).
- BullMQ Pro / dashboard UI.
- Rate limiting (M-008 separately).

## Design

```ts
// src/config/redis.ts
export function backoffMs(attempt: number, capMs = 5000, baseMs = 200): number;
export const redis: Redis;
export async function connectRedis(): Promise<void>;
export async function disconnectRedis(): Promise<void>;
```

```ts
// src/jobs/queues.ts
import { Queue } from "bullmq";
export const ORDER_QUEUE = "order-processing";
export const INVENTORY_QUEUE = "inventory-sync";

export const orderQueue = new Queue(ORDER_QUEUE, { connection: redis });
export const inventoryQueue = new Queue(INVENTORY_QUEUE, { connection: redis });
```

ioredis options for BullMQ compatibility:
- `maxRetriesPerRequest: null` (BullMQ requires this for blocking
  commands).
- `enableReadyCheck: false` for faster cold starts.
- `lazyConnect: true` so tests don't open sockets at import.

## Acceptance criteria

- [ ] Typecheck + tests green.
- [ ] `backoffMs(0) = baseMs`, `backoffMs(N)` is monotonic, capped at
      `capMs`.
- [ ] `redis.status` is `"wait"` (lazy) before `connectRedis()` is called.
- [ ] `connectRedis()` calls `connect()` and logs.
- [ ] `disconnectRedis()` calls `quit()` and logs.
- [ ] `src/jobs/queues.ts` exports named queues without throwing.

## Files touched

- `src/config/redis.ts`
- `src/config/redis.test.ts` (new)
- `src/jobs/queues.ts` (new)
- `src/jobs/worker.ts` (small change: import queues from new module)

## Open questions

- ioredis types for the constructor options vary by version. We use
  explicit typing only on what we expose, not on the entire options bag.
