import express, { type Express } from "express";
import { describe, it, expect, vi } from "vitest";
import request from "supertest";

import { errorHandler, requestId } from "../middleware/errorHandler";
import { installBillingRoutes } from "./billing";

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
  app.use("/billing", installBillingRoutes(deps));
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
