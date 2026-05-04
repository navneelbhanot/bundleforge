import { type Request, type Response, type NextFunction } from "express";
import { RateLimiterRedis, RateLimiterRes } from "rate-limiter-flexible";

import { redis } from "../config/redis";
import { logger } from "../config/logger";

// M-008 will revisit configuration (per-shop, per-route, plan-aware).
const rateLimiterInstance = new RateLimiterRedis({
  storeClient: redis,
  keyPrefix: "rl",
  points: 100,
  duration: 60,
  blockDuration: 60,
});

export async function rateLimiter(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const shopDomain = (req as Request & { shopDomain?: string }).shopDomain;
  const key = shopDomain ?? req.ip ?? "anonymous";
  try {
    await rateLimiterInstance.consume(key);
    next();
  } catch (err) {
    if (err instanceof RateLimiterRes) {
      logger.warn({ ip: req.ip, key }, "Rate limit exceeded");
      res.status(429).json({
        error: {
          message: "Too many requests. Please try again later.",
          retryAfter: Math.ceil(err.msBeforeNext / 1000),
        },
      });
      return;
    }
    next(err);
  }
}
