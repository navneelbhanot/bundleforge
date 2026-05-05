/**
 * Per-shop rate limiter middleware.
 *
 * - Production uses Redis (BullMQ-friendly singleton).
 * - Tests inject `RateLimiterMemory` to avoid Redis dependency.
 * - Plan-aware caps via the plan registry.
 *
 * See docs/specs/M-008-rate-limiter.md.
 */
import { type Request, type Response, type NextFunction, type RequestHandler } from "express";
import {
  RateLimiterMemory,
  RateLimiterRedis,
  RateLimiterRes,
} from "rate-limiter-flexible";

import { logger } from "../config/logger";
import { redis } from "../config/redis";
import {
  PLAN_RATE_LIMITS,
  type PlanName,
  planFor,
} from "../services/billing/plans";

export interface RateLimiterAdapter {
  consume(key: string, weight?: number): Promise<RateLimiterRes>;
}

interface ReqWithShop extends Request {
  shopDomain?: string;
  shopPlan?: PlanName;
}

export function deriveKey(req: Request): string {
  const r = req as ReqWithShop;
  if (r.shopDomain) return `shop:${r.shopDomain}`;
  const headerShop = req.header("x-shopify-shop-domain");
  if (headerShop) return `shop:${headerShop}`;
  return req.ip ? `ip:${req.ip}` : "anonymous";
}

export function buildRateLimiter(adapter: RateLimiterAdapter): RequestHandler {
  return async function rateLimitMiddleware(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    const key = deriveKey(req);
    try {
      await adapter.consume(key);
      next();
    } catch (err) {
      if (err instanceof RateLimiterRes) {
        const retryAfter = Math.ceil(err.msBeforeNext / 1000);
        logger.warn(
          { key, retryAfter, reqId: req.id },
          "Rate limit exceeded",
        );
        res.setHeader("Retry-After", String(retryAfter));
        res.status(429).json({
          error: {
            code: "rate_limited",
            message: "Too many requests",
            statusCode: 429,
            requestId: req.id,
            details: { retryAfterSeconds: retryAfter },
          },
        });
        return;
      }
      next(err);
    }
  };
}

/** Production adapter using shared Redis. Caps come from the starter plan;
 *  M-019/M-031 will lift this to a per-shop plan lookup. */
function buildRedisAdapter(plan: PlanName = "starter"): RateLimiterAdapter {
  const budget = PLAN_RATE_LIMITS[plan];
  return new RateLimiterRedis({
    storeClient: redis,
    keyPrefix: `rl:${plan}`,
    points: budget.points,
    duration: budget.durationSec,
    blockDuration: budget.durationSec,
  });
}

/** Test/dev adapter — pure in-memory; no external dependency. */
export function buildMemoryAdapter(plan: PlanName = "starter"): RateLimiterAdapter {
  const budget = PLAN_RATE_LIMITS[plan];
  return new RateLimiterMemory({
    keyPrefix: `rl:${plan}`,
    points: budget.points,
    duration: budget.durationSec,
    blockDuration: budget.durationSec,
  });
}

// ---------------------------------------------------------------------------
// M-148 per-IP secondary limiter — guards routes that don't yet have a shop
// session attached (`/api/auth/*`, `/api/webhooks/*`, `/health`). Keyed on
// req.ip rather than shop, so a flooder hammering OAuth or anonymous endpoints
// can't burn a real merchant's budget.

const IP_LIMIT_POINTS = 60;
const IP_LIMIT_DURATION_SEC = 60;

export function buildIpRateLimiter(
  adapter?: RateLimiterAdapter,
): RequestHandler {
  const a =
    adapter ??
    new RateLimiterMemory({
      keyPrefix: "rl:ip",
      points: IP_LIMIT_POINTS,
      duration: IP_LIMIT_DURATION_SEC,
      blockDuration: IP_LIMIT_DURATION_SEC,
    });
  return async (req, res, next) => {
    const key = `ip:${req.ip ?? "anonymous"}`;
    try {
      await a.consume(key);
      next();
    } catch (err) {
      if (err instanceof RateLimiterRes) {
        const retryAfter = Math.ceil(err.msBeforeNext / 1000);
        res.setHeader("Retry-After", String(retryAfter));
        res.status(429).json({
          error: {
            code: "rate_limited",
            message: "Too many requests",
            statusCode: 429,
            requestId: req.id,
            details: { retryAfterSeconds: retryAfter, scope: "ip" },
          },
        });
        return;
      }
      next(err);
    }
  };
}

/** Production singleton for the per-IP secondary limiter. */
function buildIpRedisAdapter(): RateLimiterAdapter {
  return new RateLimiterRedis({
    storeClient: redis,
    keyPrefix: "rl:ip",
    points: IP_LIMIT_POINTS,
    duration: IP_LIMIT_DURATION_SEC,
    blockDuration: IP_LIMIT_DURATION_SEC,
  });
}

// In tests we cannot reach Redis; the production limiter would otherwise
// stall every request for 5s waiting on the lazy connection. Tests that
// need to exercise the per-IP limiter use `buildIpRateLimiter()` directly
// with a memory adapter (see rateLimiter.test.ts).
export const ipRateLimiter: RequestHandler =
  process.env.NODE_ENV === "test"
    ? buildIpRateLimiter()
    : buildIpRateLimiter(buildIpRedisAdapter());

export const rateLimiter: RequestHandler = buildRateLimiter(
  buildRedisAdapter(planFor(undefined)),
);

// Re-export so callers can use planFor without a separate import.
export { planFor };
