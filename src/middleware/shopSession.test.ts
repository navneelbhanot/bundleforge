import express, { type Express, type Request, type Response, type NextFunction } from "express";
import { describe, it, expect, vi } from "vitest";
import request from "supertest";

import { errorHandler, requestId } from "./errorHandler";
import { requireShopSession, type ShopRow } from "./shopSession";

function buildApp(loadShop: (domain: string) => Promise<ShopRow | null>): Express {
  const app = express();
  app.use(requestId);
  // Allow tests to inject res.locals.shopify.session via a header for simplicity.
  app.use((req: Request, res: Response, next: NextFunction) => {
    const sessShop = req.header("x-test-session-shop");
    if (sessShop) {
      (res.locals as { shopify?: { session?: { shop: string } } }).shopify = {
        session: { shop: sessShop },
      };
    }
    next();
  });
  app.use(requireShopSession({ loadShop }));
  app.get("/x", (req, res) =>
    res.json({ shopId: req.shopId, shopDomain: req.shopDomain }),
  );
  app.use(errorHandler);
  return app;
}

const goodShop: ShopRow = {
  id: "shop-uuid",
  shopifyDomain: "demo.myshopify.com",
  uninstalledAt: null,
};

describe("requireShopSession", () => {
  it("loads shop from validated session and attaches shopId/shopDomain", async () => {
    const loadShop = vi.fn().mockResolvedValue(goodShop);
    const app = buildApp(loadShop);
    const res = await request(app)
      .get("/x")
      .set("x-test-session-shop", "demo.myshopify.com");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      shopId: "shop-uuid",
      shopDomain: "demo.myshopify.com",
    });
    expect(loadShop).toHaveBeenCalledWith("demo.myshopify.com");
  });

  it("falls back to x-shopify-shop-domain header when no session", async () => {
    const loadShop = vi.fn().mockResolvedValue(goodShop);
    const app = buildApp(loadShop);
    const res = await request(app)
      .get("/x")
      .set("x-shopify-shop-domain", "demo.myshopify.com");
    expect(res.status).toBe(200);
    expect(loadShop).toHaveBeenCalledWith("demo.myshopify.com");
  });

  it("returns 401 when no session, header, or query shop", async () => {
    const loadShop = vi.fn();
    const app = buildApp(loadShop);
    const res = await request(app).get("/x");
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("unauthorized");
    expect(loadShop).not.toHaveBeenCalled();
  });

  it("returns 401 when shop is not found", async () => {
    const loadShop = vi.fn().mockResolvedValue(null);
    const app = buildApp(loadShop);
    const res = await request(app)
      .get("/x")
      .set("x-test-session-shop", "demo.myshopify.com");
    expect(res.status).toBe(401);
    expect(res.body.error.message).toMatch(/Unknown shop/);
  });

  it("returns 401 when shop is uninstalled", async () => {
    const loadShop = vi.fn().mockResolvedValue({
      ...goodShop,
      uninstalledAt: new Date("2024-01-01"),
    });
    const app = buildApp(loadShop);
    const res = await request(app)
      .get("/x")
      .set("x-test-session-shop", "demo.myshopify.com");
    expect(res.status).toBe(401);
    expect(res.body.error.message).toMatch(/uninstalled/);
  });

  it("accepts ?shop= query as last resort", async () => {
    const loadShop = vi.fn().mockResolvedValue(goodShop);
    const app = buildApp(loadShop);
    const res = await request(app).get("/x?shop=demo.myshopify.com");
    expect(res.status).toBe(200);
    expect(loadShop).toHaveBeenCalledWith("demo.myshopify.com");
  });
});
