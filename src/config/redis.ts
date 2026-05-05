/**
 * Redis singleton (ioredis) tuned for BullMQ compatibility.
 *
 * - lazyConnect so module imports don't open sockets.
 * - maxRetriesPerRequest: null is required by BullMQ for blocking commands.
 * - Pure backoffMs() helper for retryStrategy and tests.
 *
 * See docs/specs/M-005-redis-bullmq.md.
 */
import IORedis, { type Redis } from "ioredis";

import { env } from "./env";
import { logger } from "./logger";

const redisLogger = logger.child({ module: "redis" });

const DEFAULT_BASE_MS = 200;
const DEFAULT_CAP_MS = 5000;

/** Pure exponential-ish backoff with cap. */
export function backoffMs(
  attempt: number,
  capMs = DEFAULT_CAP_MS,
  baseMs = DEFAULT_BASE_MS,
): number {
  const n = Math.max(0, attempt);
  return Math.min(capMs, baseMs * Math.max(1, n + 1));
}

export const redis: Redis = new IORedis(env.REDIS_URL, {
  // BullMQ requires this for blocking pop / xread.
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
  lazyConnect: true,
  retryStrategy: (times: number) => backoffMs(times),
});

redis.on("connect", () => redisLogger.info("Redis connected"));
redis.on("error", (err: Error) => redisLogger.error({ err }, "Redis error"));
redis.on("close", () => redisLogger.warn("Redis connection closed"));

export async function connectRedis(): Promise<void> {
  if (redis.status === "ready" || redis.status === "connecting") {
    return;
  }
  await redis.connect();
}

export async function disconnectRedis(): Promise<void> {
  if (redis.status === "end") return;
  await redis.quit();
  redisLogger.info("Redis disconnected");
}
