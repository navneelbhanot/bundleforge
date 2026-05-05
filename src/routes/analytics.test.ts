import express, { type Express } from "express";
import { describe, it, expect, vi } from "vitest";
import request from "supertest";

import { errorHandler, requestId } from "../middleware/errorHandler";
import { installAnalyticsRoutes } from "./analytics";
import { AnalyticsService } from "../services/analytics";

function buildApp(service: Partial<AnalyticsService>): Express {
  const app = express();
  app.use(requestId);
  app.use(express.json());
  app.use((req, _res, next) => {
    req.shopId = "shop-uuid";
    next();
  });
  app.use(
    "/analytics",
    installAnalyticsRoutes({ service: service as AnalyticsService }),
  );
  app.use(errorHandler);
  return app;
}

describe("POST /analytics/events", () => {
  it("ingests valid events", async () => {
    const ingest = vi.fn().mockResolvedValue({ count: 2 });
    const res = await request(buildApp({ ingest }))
      .post("/analytics/events")
      .send({
        events: [
          {
            bundleId: "00000000-0000-0000-0000-000000000001",
            eventType: "view",
          },
          {
            bundleId: "00000000-0000-0000-0000-000000000001",
            eventType: "purchase",
            revenue: 12.5,
          },
        ],
      });
    expect(res.status).toBe(202);
    expect(res.body.ingested).toBe(2);
  });

  it("rejects malformed events", async () => {
    const ingest = vi.fn();
    const res = await request(buildApp({ ingest }))
      .post("/analytics/events")
      .send({ events: [{ bundleId: "not-uuid", eventType: "view" }] });
    expect(res.status).toBe(400);
    expect(ingest).not.toHaveBeenCalled();
  });

  it("rejects empty batch", async () => {
    const res = await request(buildApp({ ingest: vi.fn() }))
      .post("/analytics/events")
      .send({ events: [] });
    expect(res.status).toBe(400);
  });
});

describe("GET /analytics/overview", () => {
  it("returns rolled-up totals", async () => {
    const overview = vi.fn().mockResolvedValue({
      revenue: { _sum: { revenue: 1234 } },
      orders: 56,
      byBundle: [
        { bundleId: "b1", _sum: { revenue: 800 }, _count: { _all: 30 } },
      ],
    });
    const res = await request(buildApp({ overview })).get("/analytics/overview");
    expect(res.status).toBe(200);
    expect(res.body.totalRevenue).toBe(1234);
    expect(res.body.totalOrders).toBe(56);
    expect(res.body.topBundles[0].bundleId).toBe("b1");
  });
});

describe("POST /analytics/ab-tests/significance", () => {
  it("returns significance result for given samples", async () => {
    const res = await request(buildApp({}))
      .post("/analytics/ab-tests/significance")
      .send({
        a: { conversions: 50, exposures: 1000 },
        b: { conversions: 100, exposures: 1000 },
      });
    expect(res.status).toBe(200);
    expect(res.body.significant).toBe(true);
    expect(res.body.winner).toBe("B");
  });
});
