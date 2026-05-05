import express, { type Express } from "express";
import { describe, it, expect, vi } from "vitest";
import request from "supertest";

import { errorHandler, requestId } from "../middleware/errorHandler";
import { installOrdersRoutes } from "./orders";
import { orderRepo } from "../services/orders/repository";

function buildApp(repo: typeof orderRepo, withShop = true): Express {
  const app = express();
  app.use(requestId);
  app.use(express.json());
  app.use((req, _res, next) => {
    if (withShop) req.shopId = "shop-uuid";
    next();
  });
  app.use("/orders", installOrdersRoutes({ repo }));
  app.use(errorHandler);
  return app;
}

const fakeRepo = (): typeof orderRepo => ({
  list: vi.fn().mockResolvedValue({ data: [{ id: "o-1" }], total: 1 }),
  findById: vi.fn(),
});

describe("GET /orders", () => {
  it("returns paginated list", async () => {
    const repo = fakeRepo();
    const app = buildApp(repo);
    const res = await request(app).get("/orders?page=2&limit=10&status=processed");
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(repo.list).toHaveBeenCalledWith("shop-uuid", {
      page: 2,
      limit: 10,
      status: "processed",
    });
  });
});

describe("GET /orders/:id", () => {
  it("returns 404 when not found", async () => {
    const repo = fakeRepo();
    repo.findById = vi.fn().mockResolvedValue(null);
    const app = buildApp(repo);
    const res = await request(app).get("/orders/missing");
    expect(res.status).toBe(404);
  });

  it("returns order with sku breakdown", async () => {
    const repo = fakeRepo();
    repo.findById = vi.fn().mockResolvedValue({
      id: "o-1",
      skuBreakdown: [{ sku: "A", quantity: 2 }],
    });
    const app = buildApp(repo);
    const res = await request(app).get("/orders/o-1");
    expect(res.status).toBe(200);
    expect(res.body.skuBreakdown).toHaveLength(1);
  });
});
