import express, { type Express } from "express";
import { describe, it, expect, vi } from "vitest";
import request from "supertest";

import { errorHandler, requestId } from "../middleware/errorHandler";
import { installGdprRoutes, type GdprClient } from "./gdpr";

function buildApp(client: GdprClient, shopId: string | null = "shop-1"): Express {
  const app = express();
  app.use(requestId);
  app.use(express.json());
  app.use((req, _res, next) => {
    if (shopId) req.shopId = shopId;
    next();
  });
  app.use("/gdpr", installGdprRoutes({ client }));
  app.use(errorHandler);
  return app;
}

function makeClient(overrides: Partial<GdprClient> = {}): GdprClient {
  return {
    shop: {
      findUnique: vi.fn().mockResolvedValue({
        id: "shop-1",
        shopifyDomain: "demo.myshopify.com",
        name: "Demo",
        accessToken: "shpat_secret_xyz",
      }),
      deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
      ...overrides.shop,
    },
    bundle: {
      findMany: vi.fn().mockResolvedValue([{ id: "b1", title: "T" }]),
      ...overrides.bundle,
    },
    bundleOrder: {
      findMany: vi.fn().mockResolvedValue([{ id: "o1" }]),
      ...overrides.bundleOrder,
    },
    inventoryAuditLog: {
      findMany: vi.fn().mockResolvedValue([{ id: "a1", delta: -1 }]),
      ...overrides.inventoryAuditLog,
    },
    integration: {
      findMany: vi.fn().mockResolvedValue([
        { id: "i1", type: "klaviyo", credentials: { apiKey: "secret" } },
      ]),
      ...overrides.integration,
    },
  };
}

describe("POST /gdpr/export", () => {
  it("returns shop dump with creds redacted", async () => {
    const client = makeClient();
    const res = await request(buildApp(client)).post("/gdpr/export");
    expect(res.status).toBe(200);
    expect(res.body.shop.shopifyDomain).toBe("demo.myshopify.com");
    expect(res.body.shop.accessToken).toBe("[REDACTED]");
    expect(res.body.bundles).toHaveLength(1);
    expect(res.body.orders).toHaveLength(1);
    expect(res.body.inventoryAuditLog).toHaveLength(1);
    expect(res.body.integrations[0].credentials).toBe("[REDACTED]");
    expect(typeof res.body.generatedAt).toBe("string");
  });

  it("scopes every query to req.shopId", async () => {
    const client = makeClient();
    await request(buildApp(client, "shop-tenant-A")).post("/gdpr/export");
    expect(client.bundle.findMany).toHaveBeenCalledWith({
      where: { shopId: "shop-tenant-A" },
    });
    expect(client.bundleOrder.findMany).toHaveBeenCalledWith({
      where: { shopId: "shop-tenant-A" },
    });
    expect(client.inventoryAuditLog.findMany).toHaveBeenCalledWith({
      where: { shopId: "shop-tenant-A" },
    });
    expect(client.integration.findMany).toHaveBeenCalledWith({
      where: { shopId: "shop-tenant-A" },
    });
  });

  it("401 without shop context", async () => {
    const client = makeClient();
    const res = await request(buildApp(client, null)).post("/gdpr/export");
    expect(res.status).toBe(401);
  });

  it("404 when shop missing", async () => {
    const client = makeClient({
      shop: {
        findUnique: vi.fn().mockResolvedValue(null),
        deleteMany: vi.fn(),
      },
    });
    const res = await request(buildApp(client)).post("/gdpr/export");
    expect(res.status).toBe(404);
  });
});

describe("POST /gdpr/delete-shop", () => {
  it("hard-deletes the shop row scoped to req.shopId", async () => {
    const client = makeClient();
    const res = await request(buildApp(client, "shop-A")).post(
      "/gdpr/delete-shop",
    );
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ deleted: true, shopId: "shop-A" });
    expect(client.shop.deleteMany).toHaveBeenCalledWith({
      where: { id: "shop-A" },
    });
  });

  it("404 when shop already gone", async () => {
    const client = makeClient({
      shop: {
        findUnique: vi.fn(),
        deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
      },
    });
    const res = await request(buildApp(client)).post("/gdpr/delete-shop");
    expect(res.status).toBe(404);
  });

  it("401 without shop context", async () => {
    const client = makeClient();
    const res = await request(buildApp(client, null)).post(
      "/gdpr/delete-shop",
    );
    expect(res.status).toBe(401);
  });
});
