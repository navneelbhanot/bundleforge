import express, { type Express } from "express";
import { describe, it, expect, vi } from "vitest";
import request from "supertest";

import { errorHandler, requestId } from "./errorHandler";
import { enforceCap, requirePlanFeature } from "./planCaps";

function buildApp(handlerSetup: (app: Express) => void): Express {
  const app = express();
  app.use(requestId);
  // Inject a shopId on every request.
  app.use((req, _res, next) => {
    req.shopId = "shop-uuid";
    next();
  });
  handlerSetup(app);
  app.use(errorHandler);
  return app;
}

describe("requirePlanFeature", () => {
  it("allows the request when feature is in plan", async () => {
    const resolver = vi.fn().mockResolvedValue("pro");
    const app = buildApp((a) => {
      a.get(
        "/x",
        requirePlanFeature("threePlSync", { resolver }),
        (_req, res) => res.json({ ok: true }),
      );
    });
    const res = await request(app).get("/x");
    expect(res.status).toBe(200);
  });

  it("rejects with 403 + feature_not_in_plan when missing", async () => {
    const resolver = vi.fn().mockResolvedValue("growth");
    const app = buildApp((a) => {
      a.get(
        "/x",
        requirePlanFeature("threePlSync", { resolver }),
        (_req, res) => res.json({ ok: true }),
      );
    });
    const res = await request(app).get("/x");
    expect(res.status).toBe(403);
    expect(res.body.error.details.code).toBe("feature_not_in_plan");
  });

  it("rejects when no shopId is set", async () => {
    const app = express();
    app.use(requestId);
    app.get(
      "/x",
      requirePlanFeature("threePlSync"),
      (_req, res) => res.json({ ok: true }),
    );
    app.use(errorHandler);
    const res = await request(app).get("/x");
    expect(res.status).toBe(403);
  });
});

describe("enforceCap maxBundles", () => {
  it("allows when count below cap", async () => {
    const resolver = vi.fn().mockResolvedValue("starter"); // cap 5
    const counter = { count: vi.fn().mockResolvedValue(2) };
    const app = buildApp((a) => {
      a.get(
        "/x",
        enforceCap("maxBundles", { resolver, counter }),
        (_req, res) => res.json({ ok: true }),
      );
    });
    const res = await request(app).get("/x");
    expect(res.status).toBe(200);
  });

  it("rejects 403 when count >= cap", async () => {
    const resolver = vi.fn().mockResolvedValue("starter");
    const counter = { count: vi.fn().mockResolvedValue(5) };
    const app = buildApp((a) => {
      a.get(
        "/x",
        enforceCap("maxBundles", { resolver, counter }),
        (_req, res) => res.json({ ok: true }),
      );
    });
    const res = await request(app).get("/x");
    expect(res.status).toBe(403);
    expect(res.body.error.details.code).toBe("plan_cap_reached");
  });

  it("allows unlimited plans (cap === null) without counting", async () => {
    const resolver = vi.fn().mockResolvedValue("pro");
    const counter = { count: vi.fn() };
    const app = buildApp((a) => {
      a.get(
        "/x",
        enforceCap("maxBundles", { resolver, counter }),
        (_req, res) => res.json({ ok: true }),
      );
    });
    const res = await request(app).get("/x");
    expect(res.status).toBe(200);
    expect(counter.count).not.toHaveBeenCalled();
  });
});
