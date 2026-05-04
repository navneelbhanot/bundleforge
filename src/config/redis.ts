import Redis from "ioredis";
import { logger } from "./logger";

const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";

export const redis = new Redis(REDIS_URL, {
  maxRetriesPerRequest: 3,
  retryStrategy(times) {
    const delay = Math.min(times * 200, 5000);
    return delay;
  },
  lazyConnect: true,
});

redis.on("connect", () => logger.info("Redis connected"));
redis.on("error", (err) => logger.error({ err }, "Redis error"));
redis.on("close", () => logger.warn("Redis connection closed"));

export async function connectRedis() {
  try {
    await redis.connect();
  } catch (error) {
    logger.error({ err: error }, "Failed to connect to Redis");
  }
}
