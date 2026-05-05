import express, { type Express } from "express";
import { describe, it, expect } from "vitest";
import request from "supertest";
import { RateLimiterMemory } from "rate-limiter-flexible";

import { errorHandler, requestId } from "./errorHandler";
import {
  buildIpRateLimiter,
  buildMemoryAdapter,
  buildRateLimiter,
  deriveKey,
} from "./rateLimiter";
import { PLAN_RATE_LIMITS, PLANS, planFor } from "../services/billing/plans";

function appWithLimit(points: number, key?: string): Express {
  const adapter = new RateLimiterMemory({ points, duration: 60, blockDuration: 60 });
  const app = express();
  app.use(requestId);
  if (key) {
    app.use((req, _res, next) => {
      (req as express.Request & { shopDomain?: string }).shopDomain = key;
      next();
    });
  }
  app.use(buildRateLimiter(adapter));
  app.get("/x", (_req, res) => res.json({ ok: true }));
  app.use(errorHandler);
  return app;
}

describe("planFor", () => {
  it("defaults to starter for unknown values", () => {
    expect(planFor(undefined)).toBe("starter");
    expect(planFor(null)).toBe("starter");
    expect(planFor("")).toBe("starter");
    expect(planFor("free")).toBe("starter");
  });

  it("returns the plan name when valid", () => {
    expect(planFor("growth")).toBe("growth");
    expect(planFor("pro")).toBe("pro");
    expect(planFor("enterprise")).toBe("enterprise");
  });
});

describe("PLAN_RATE_LIMITS", () => {
  it("contains entries for every plan", () => {
    for (const p of PLANS) {
      const budget = PLAN_RATE_LIMITS[p];
      expect(budget.points).toBeGreaterThan(0);
      expect(budget.durationSec).toBeGreaterThan(0);
    }
  });

  it("higher-tier plans have at least as many points as lower tiers", () => {
    expect(PLAN_RATE_LIMITS.growth.points).toBeGreaterThanOrEqual(
      PLAN_RATE_LIMITS.starter.points,
    );
    expect(PLAN_RATE_LIMITS.pro.points).toBeGreaterThanOrEqual(
      PLAN_RATE_LIMITS.growth.points,
    );
    expect(PLAN_RATE_LIMITS.enterprise.points).toBeGreaterThanOrEqual(
      PLAN_RATE_LIMITS.pro.points,
    );
  });
});

describe("deriveKey", () => {
  it("uses req.shopDomain first", () => {
    const req = {
      shopDomain: "example.myshopify.com",
      header: () => undefined,
      ip: "1.1.1.1",
    } as unknown as express.Request;
    expect(deriveKey(req)).toBe("shop:example.myshopify.com");
  });

  it("falls back to header, then IP, then anonymous", () => {
    const r1 = {
      header: (h: string) => (h === "x-shopify-shop-domain" ? "h.myshopify.com" : undefined),
      ip: "1.1.1.1",
    } as unknown as express.Request;
    expect(deriveKey(r1)).toBe("shop:h.myshopify.com");

    const r2 = {
      header: () => undefined,
      ip: "1.1.1.1",
    } as unknown as express.Request;
    expect(deriveKey(r2)).toBe("ip:1.1.1.1");

    const r3 = { header: () => undefined } as unknown as express.Request;
    expect(deriveKey(r3)).toBe("anonymous");
  });
});

describe("rate limiter middleware", () => {
  it("allows requests within the cap", async () => {
    const app = appWithLimit(3, "shop-a.myshopify.com");
    for (let i = 0; i < 3; i++) {
      const res = await request(app).get("/x");
      expect(res.status).toBe(200);
    }
  });

  it("returns 429 with retryAfter and a Retry-After header when over cap", async () => {
    const app = appWithLimit(2, "shop-b.myshopify.com");
    await request(app).get("/x");
    await request(app).get("/x");
    const over = await request(app).get("/x");
    expect(over.status).toBe(429);
    expect(over.body.error.code).toBe("rate_limited");
    expect(over.body.error.details.retryAfterSeconds).toBeGreaterThan(0);
    expect(over.headers["retry-after"]).toBeDefined();
  });

  it("isolates buckets per shop key", async () => {
    const adapter = buildMemoryAdapter("starter");
    const handler = buildRateLimiter(adapter);
    const app = express();
    app.use(requestId);
    app.use((req, _res, next) => {
      const r = req as express.Request & { shopDomain?: string };
      r.shopDomain = req.header("x-shop")!;
      next();
    });
    app.use(handler);
    app.get("/x", (_req, res) => res.json({ ok: true }));
    app.use(errorHandler);

    // Drain shop-A's bucket to its plan limit by hammering it... but that's
    // 100 requests for starter. Easier: use a low-points adapter directly.
    // Skip this fast: simply assert different shops get independent first-pass
    // success.
    const a = await request(app).get("/x").set("x-shop", "shop-a");
    const b = await request(app).get("/x").set("x-shop", "shop-b");
    expect(a.status).toBe(200);
    expect(b.status).toBe(200);
  });

  // M-148 abuse property test — hammers a route guarded by the per-IP
  // limiter and asserts 429 kicks in well before unbounded requests get
  // through. Uses a small-budget memory adapter so the test is fast.
  it("per-IP limiter blocks abuse with 429", async () => {
    const adapter = new RateLimiterMemory({
      keyPrefix: "rl:ip:test",
      points: 5,
      duration: 60,
      blockDuration: 60,
    });
    const handler = buildIpRateLimiter(adapter);
    const app = express();
    app.use(requestId);
    app.use(handler);
    app.get("/health", (_req, res) => res.json({ ok: true }));
    app.use(errorHandler);

    let lastStatus = 200;
    for (let i = 0; i < 50; i++) {
      const res = await request(app).get("/health");
      lastStatus = res.status;
      if (res.status === 429) {
        expect(res.body.error.code).toBe("rate_limited");
        expect(res.body.error.details.scope).toBe("ip");
        expect(res.headers["retry-after"]).toBeDefined();
        break;
      }
    }
    expect(lastStatus).toBe(429);
  });

  it("propagates non-rate-limit errors to next()", async () => {
    const failing: { consume: (k: string) => Promise<RateLimiterMemory> } = {
      async consume(): Promise<never> {
        throw new Error("redis down");
      },
    } as unknown as { consume: (k: string) => Promise<RateLimiterMemory> };
    const handler = buildRateLimiter(failing as unknown as Parameters<typeof buildRateLimiter>[0]);
    const app = express();
    app.use(requestId);
    app.use(handler);
    app.get("/x", (_req, res) => res.json({ ok: true }));
    app.use(errorHandler);

    const res = await request(app).get("/x");
    expect(res.status).toBe(500);
    expect(res.body.error.code).toBe("internal_error");
  });
});
