import express, { type Express } from "express";
import { describe, it, expect, vi } from "vitest";
import request from "supertest";

import { errorHandler, requestId } from "../middleware/errorHandler";
import { installAiRoutes, type BasketSource } from "./ai";

function buildApp(deps: Parameters<typeof installAiRoutes>[0]): Express {
  const app = express();
  app.use(requestId);
  app.use(express.json());
  app.use((req, _res, next) => {
    req.shopId = "shop-uuid";
    next();
  });
  app.use("/ai", installAiRoutes(deps));
  app.use(errorHandler);
  return app;
}

describe("GET /ai/recommendations", () => {
  it("returns 400 when target is missing", async () => {
    const recommend = vi.fn();
    const source: BasketSource = {
      bundleOrder: { findMany: vi.fn().mockResolvedValue([]) },
    };
    const res = await request(buildApp({ source, recommend })).get(
      "/ai/recommendations",
    );
    expect(res.status).toBe(400);
    expect(recommend).not.toHaveBeenCalled();
  });

  it("derives baskets from skuBreakdown JSON and calls recommender", async () => {
    const recommend = vi.fn().mockResolvedValue([
      { product_id: "B", support: 0.5, confidence: 0.5, lift: 2 },
    ]);
    const source: BasketSource = {
      bundleOrder: {
        findMany: vi.fn().mockResolvedValue([
          {
            skuBreakdown: [
              { shopifyProductGid: "A" },
              { shopifyProductGid: "B" },
            ],
          },
          {
            skuBreakdown: [
              { sku: "A" },
              { sku: "C" },
            ],
          },
          { skuBreakdown: null }, // dropped — not an array
          { skuBreakdown: [{ shopifyProductGid: "" }] }, // dropped — only 1 item
        ]),
      },
    };
    const res = await request(buildApp({ source, recommend })).get(
      "/ai/recommendations?target=A",
    );
    expect(res.status).toBe(200);
    expect(res.body.target).toBe("A");
    expect(res.body.recommendations).toHaveLength(1);
    expect(recommend).toHaveBeenCalledTimes(1);
    expect(recommend.mock.calls[0][0].baskets).toEqual([
      ["A", "B"],
      ["A", "C"],
    ]);
    expect(recommend.mock.calls[0][0].topN).toBe(5);
  });

  it("clamps topN to 1..20", async () => {
    const recommend = vi.fn().mockResolvedValue([]);
    const source: BasketSource = {
      bundleOrder: { findMany: vi.fn().mockResolvedValue([]) },
    };
    await request(buildApp({ source, recommend })).get(
      "/ai/recommendations?target=A&topN=999",
    );
    expect(recommend.mock.calls[0][0].topN).toBe(20);
  });
});
