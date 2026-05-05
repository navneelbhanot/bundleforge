import express, { type Express } from "express";
import { describe, it, expect, vi } from "vitest";
import request from "supertest";

import { errorHandler, requestId } from "../middleware/errorHandler";
import { installInventoryRoutes, type AuditQuerySource } from "./inventory";

function buildApp(source: AuditQuerySource): Express {
  const app = express();
  app.use(requestId);
  app.use(express.json());
  app.use((req, _res, next) => {
    req.shopId = "shop-uuid";
    next();
  });
  app.use("/inventory", installInventoryRoutes({ source }));
  app.use(errorHandler);
  return app;
}

const fakeSource = (): AuditQuerySource => ({
  inventoryAuditLog: {
    findMany: vi.fn().mockResolvedValue([{ id: "a-1" }, { id: "a-2" }]),
    count: vi.fn().mockResolvedValue(42),
  },
  inventorySyncState: {
    groupBy: vi.fn().mockResolvedValue([
      { syncStatus: "synced", _count: { _all: 5 } },
      { syncStatus: "locked", _count: { _all: 1 } },
    ]),
  },
});

describe("GET /inventory/audit", () => {
  it("paginates with sensible defaults and returns total", async () => {
    const source = fakeSource();
    const app = buildApp(source);
    const res = await request(app).get("/inventory/audit");
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.pagination.total).toBe(42);
    expect(res.body.pagination.limit).toBe(50);
  });

  it("clamps limit to 200 max", async () => {
    const source = fakeSource();
    const app = buildApp(source);
    const res = await request(app).get("/inventory/audit?limit=99999");
    expect(res.body.pagination.limit).toBe(200);
  });
});

describe("GET /inventory/health", () => {
  it("returns counts by syncStatus, defaulting missing to 0", async () => {
    const source = fakeSource();
    const app = buildApp(source);
    const res = await request(app).get("/inventory/health");
    expect(res.status).toBe(200);
    expect(res.body.counts).toEqual({
      synced: 5,
      pending: 0,
      error: 0,
      locked: 1,
    });
  });
});

describe("POST /inventory/sync", () => {
  it("returns 202 and acknowledges queueing", async () => {
    const source = fakeSource();
    const app = buildApp(source);
    const res = await request(app).post("/inventory/sync").send({});
    expect(res.status).toBe(202);
    expect(res.body.queued).toBe(true);
  });
});
