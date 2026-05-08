import express, { type Express } from "express";
import { describe, it, expect, vi } from "vitest";
import request from "supertest";

import { errorHandler, requestId } from "../middleware/errorHandler";
import { installBillingRoutes, type BillingDeps } from "./billing";

function buildApp(deps: Parameters<typeof installBillingRoutes>[0]): Express {
  const app = express();
  app.use(requestId);
  app.use(express.json());
  // Simulate session/shop middleware.
  app.use((req, res, next) => {
    req.shopId = "shop-uuid";
    (res.locals as { shopify?: { session?: unknown } }).shopify = {
      session: { shop: "demo.myshopify.com", accessToken: "t" },
    };
    next();
  });
  // Default stubs so existing tests don't hit Prisma.
  // - loadOrderCap: M-201's banner-state cases pass their own.
  // - loadOfflineSession: M-205's offline-session swap is what
  //   actually calls Shopify; stub returns a fake offline Session
  //   so /subscribe and /cancel reach the create/cancel mocks.
  const withDefaults = {
    ...deps,
    loadOrderCap:
      deps?.loadOrderCap ??
      (async (shop: { id: string; planName: string }) => ({
        plan: shop.planName as "starter",
        cap: null as number | null,
        count: 0,
        over: false,
      })),
    loadOfflineSession:
      deps?.loadOfflineSession ??
      (async (shopDomain: string) => ({
        shop: shopDomain,
        accessToken: "offline-test-token",
        isOnline: false,
      } as unknown as import("@shopify/shopify-api").Session)),
  };
  app.use("/billing", installBillingRoutes(withDefaults));
  app.use(errorHandler);
  return app;
}

describe("GET /billing/plans", () => {
  it("returns all four plans with caps + features", async () => {
    const app = buildApp({});
    const res = await request(app).get("/billing/plans");
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(4);
    expect(res.body[0].name).toBe("starter");
    expect(res.body[3].name).toBe("enterprise");
    expect(res.body[3].features.headless).toBe(true);
  });
});

describe("GET /billing", () => {
  it("returns starter plan when no subscription exists", async () => {
    const app = buildApp({
      loadSubscription: async () => null,
    });
    const res = await request(app).get("/billing");
    expect(res.status).toBe(200);
    expect(res.body.plan).toBe("starter");
    expect(res.body.subscription).toBeNull();
  });

  it("returns the subscription's plan when present", async () => {
    const app = buildApp({
      loadSubscription: async () => ({
        planName: "pro",
        status: "active",
        shopifyChargeId: "gid://A/1",
        billingInterval: "monthly",
        trialEndsAt: null,
        activatedAt: new Date(),
        cancelledAt: null,
      }),
    });
    const res = await request(app).get("/billing");
    expect(res.body.plan).toBe("pro");
    expect(res.body.features.threePlSync).toBe(true);
  });

  describe("orderCap field (M-201)", () => {
    it("approaching=false on Starter at 79 of 100", async () => {
      const app = buildApp({
        loadSubscription: async () => null,
        loadOrderCap: async () => ({
          plan: "starter",
          cap: 100,
          count: 79,
          over: false,
        }),
      });
      const res = await request(app).get("/billing");
      expect(res.body.orderCap).toEqual({
        plan: "starter",
        cap: 100,
        count: 79,
        over: false,
        approaching: false,
      });
    });

    it("approaching=true on Starter at 80 of 100 (exact threshold)", async () => {
      const app = buildApp({
        loadSubscription: async () => null,
        loadOrderCap: async () => ({
          plan: "starter",
          cap: 100,
          count: 80,
          over: false,
        }),
      });
      const res = await request(app).get("/billing");
      expect(res.body.orderCap.approaching).toBe(true);
      expect(res.body.orderCap.over).toBe(false);
    });

    it("approaching=false but over=true at exactly the cap", async () => {
      const app = buildApp({
        loadSubscription: async () => null,
        loadOrderCap: async () => ({
          plan: "starter",
          cap: 100,
          count: 100,
          over: true,
        }),
      });
      const res = await request(app).get("/billing");
      expect(res.body.orderCap.over).toBe(true);
      // approaching MUST be false once over is true — banner UX
      // chooses one or the other, not both.
      expect(res.body.orderCap.approaching).toBe(false);
    });

    it("approaching/over both false on paid plan (cap=null)", async () => {
      const app = buildApp({
        loadSubscription: async () => ({
          planName: "growth",
          status: "active",
          shopifyChargeId: "gid://A/1",
          billingInterval: "monthly",
          trialEndsAt: null,
          activatedAt: new Date(),
          cancelledAt: null,
        }),
        loadOrderCap: async () => ({
          plan: "growth",
          cap: null,
          count: 5_000,
          over: false,
        }),
      });
      const res = await request(app).get("/billing");
      expect(res.body.orderCap).toEqual({
        plan: "growth",
        cap: null,
        count: 5_000,
        over: false,
        approaching: false,
      });
    });
  });
});

describe("POST /billing/subscribe", () => {
  it("calls create and returns confirmationUrl", async () => {
    const create = vi.fn().mockResolvedValue({
      confirmationUrl: "https://shopify/auth",
      chargeId: "gid://A/1",
    });
    const app = buildApp({ create });
    const res = await request(app)
      .post("/billing/subscribe")
      .send({ plan: "growth", interval: "monthly" });
    expect(res.status).toBe(200);
    expect(res.body.confirmationUrl).toBe("https://shopify/auth");
    expect(create).toHaveBeenCalledTimes(1);
    const args = create.mock.calls[0][0];
    expect(args.shopId).toBe("shop-uuid");
    expect(args.plan).toBe("growth");
    expect(args.interval).toBe("monthly");
  });

  it("passes the OFFLINE session to createSubscription, not the online one (M-205)", async () => {
    // appSubscriptionCreate is shop-level — Shopify rejects the
    // user-scoped online token at the gateway with a 400 + empty
    // body. The route must swap to the offline session.
    const create = vi.fn().mockResolvedValue({
      confirmationUrl: "https://x",
      chargeId: "gid://A/1",
    });
    const offlineSession = {
      shop: "demo.myshopify.com",
      accessToken: "offline-token-X",
      isOnline: false,
    };
    const loadOfflineSession = vi.fn().mockResolvedValue(offlineSession);
    const app = buildApp({
      create,
      loadOfflineSession: loadOfflineSession as unknown as BillingDeps["loadOfflineSession"],
    });
    await request(app)
      .post("/billing/subscribe")
      .send({ plan: "growth", interval: "annual" });
    expect(loadOfflineSession).toHaveBeenCalledWith("demo.myshopify.com");
    expect(create.mock.calls[0][0].session).toBe(offlineSession);
    expect(create.mock.calls[0][0].session.isOnline).toBe(false);
  });

  it("falls back to the online session when no offline session is persisted (M-212)", async () => {
    // Pre-M-212 we 401'd. Post-M-212 we use the online session
    // because Shopify accepts both for billing on embedded apps;
    // 401-on-missing-offline was a self-inflicted dead-end when
    // Token Exchange flows mint only online tokens.
    const create = vi.fn().mockResolvedValue({
      confirmationUrl: "https://x",
      chargeId: "gid://A/1",
    });
    const app = buildApp({
      create,
      loadOfflineSession: (async () => null) as unknown as BillingDeps["loadOfflineSession"],
    });
    const res = await request(app)
      .post("/billing/subscribe")
      .send({ plan: "growth", interval: "annual" });
    expect(res.status).toBe(200);
    expect(create).toHaveBeenCalledTimes(1);
    // The session passed to create was the online session from
    // res.locals.shopify.session (set up in buildApp).
    expect(create.mock.calls[0][0].session.shop).toBe(
      "demo.myshopify.com",
    );
  });

  it("rejects invalid plan", async () => {
    const create = vi.fn();
    const app = buildApp({ create });
    const res = await request(app)
      .post("/billing/subscribe")
      .send({ plan: "starter", interval: "monthly" });
    expect(res.status).toBe(400);
    expect(create).not.toHaveBeenCalled();
  });

  it("rejects invalid interval", async () => {
    const app = buildApp({ create: vi.fn() });
    const res = await request(app)
      .post("/billing/subscribe")
      .send({ plan: "growth", interval: "weekly" });
    expect(res.status).toBe(400);
  });
});

describe("POST /billing/cancel", () => {
  it("loads subscription then calls cancel with the chargeId", async () => {
    const cancel = vi.fn().mockResolvedValue({ status: "CANCELLED" });
    const app = buildApp({
      cancel,
      loadSubscription: async () => ({
        planName: "growth",
        status: "active",
        shopifyChargeId: "gid://A/42",
        billingInterval: "monthly",
        trialEndsAt: null,
        activatedAt: new Date(),
        cancelledAt: null,
      }),
    });
    const res = await request(app).post("/billing/cancel").send({});
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("CANCELLED");
    expect(cancel).toHaveBeenCalledTimes(1);
    expect(cancel.mock.calls[0][0].chargeId).toBe("gid://A/42");
  });

  it("returns 404 when no subscription exists", async () => {
    const cancel = vi.fn();
    const app = buildApp({
      cancel,
      loadSubscription: async () => null,
    });
    const res = await request(app).post("/billing/cancel").send({});
    expect(res.status).toBe(404);
    expect(cancel).not.toHaveBeenCalled();
  });
});
