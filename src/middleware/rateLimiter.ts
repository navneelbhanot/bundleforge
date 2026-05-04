import { Request, Response, NextFunction } from "express";
import { RateLimiterRedis } from "rate-limiter-flexible";
import { redis } from "../config/redis";
import { logger } from "../config/logger";

const rateLimiterInstance = new RateLimiterRedis({
  storeClient: redis,
  keyPrefix: "rl",
  points: 100,        // 100 requests
  duration: 60,        // per 60 seconds
  blockDuration: 60,   // block for 60s if exceeded
});

export async function rateLimiter(req: Request, res: Response, next: NextFunction) {
  try {
    // Key by shop domain from session (or IP as fallback)
    const key = (req as any).shopDomain || req.ip || "anonymous";
    await rateLimiterInstance.consume(key);
    next();
  } catch (rejRes: any) {
    logger.warn(`Rate limit exceeded for ${req.ip}`);
    res.status(429).json({
      error: {
        message: "Too many requests. Please try again later.",
        retryAfter: Math.ceil(rejRes.msBeforeNext / 1000),
      },
    });
  }
}
