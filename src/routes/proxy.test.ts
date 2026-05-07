import express, { type Express } from "express";
import { describe, it, expect, vi } from "vitest";
import request from "supertest";

import { errorHandler, requestId } from "../middleware/errorHandler";
import { installProxyRoutes, type BundleLookup, type ProxyDeps } from "./proxy";

function buildApp(
  source: BundleLookup,
  withShop = true,
  extra: Partial<ProxyDeps> = {},
): Express {
  const app = express();
  app.use(requestId);
  app.use(express.json());
  app.use((req, _res, next) => {
    if (withShop) req.shopifyShopDomain = "demo.myshopify.com";
    next();
  });
  // Default to a passthrough orderCap stub so existing tests don't
  // hit Prisma. M-200 cap-reject behaviour is exercised by tests that
  // pass their own `orderCap` resolver.
  const orderCap =
    extra.orderCap ??
    vi.fn().mockResolvedValue({
      over: false,
      cap: null,
      count: 0,
      plan: "growth" as const,
    });
  app.use("/proxy", installProxyRoutes({ source, ...extra, orderCap }));
  app.use(errorHandler);
  return app;
}

describe("GET /proxy/bundle/:slug", () => {
  it("returns the bundle JSON when found", async () => {
    const source: BundleLookup = {
      bundle: {
        findFirst: vi.fn().mockResolvedValue({
          id: "b-1",
          slug: "summer-box",
          title: "Summer Box",
          type: "fixed",
          description: "Light + breezy",
          config: {},
          displaySettings: { layout: "grid" },
          items: [{ shopifyProductGid: "gid://Product/1", title: "Sunscreen" }],
        }),
      },
    };
    const app = buildApp(source);
    const res = await request(app).get("/proxy/bundle/summer-box");
    expect(res.status).toBe(200);
    expect(res.body.slug).toBe("summer-box");
    expect(res.body.items).toHaveLength(1);
    expect(res.headers["cache-control"]).toMatch(/max-age=60/);
  });

  it("returns 404 when bundle is missing", async () => {
    const source: BundleLookup = {
      bundle: { findFirst: vi.fn().mockResolvedValue(null) },
    };
    const app = buildApp(source);
    const res = await request(app).get("/proxy/bundle/missing");
    expect(res.status).toBe(404);
  });

  it("returns 401 when shop is not on request", async () => {
    const source: BundleLookup = {
      bundle: { findFirst: vi.fn() },
    };
    const app = buildApp(source, false);
    const res = await request(app).get("/proxy/bundle/x");
    expect(res.status).toBe(401);
  });
});

describe("POST /proxy/validate-cart (M-086)", () => {
  it("returns valid:true for a multipack with the right qty", async () => {
    const source: BundleLookup = {
      bundle: {
        findFirst: vi.fn().mockResolvedValue({
          type: "multipack",
          config: { packQuantity: 6 },
          items: [],
        }),
      },
    };
    const app = buildApp(source);
    const res = await request(app)
      .post("/proxy/validate-cart")
      .send({
        slug: "six-pack",
        lines: [{ shopifyProductGid: "gid://x", quantity: 6 }],
      });
    expect(res.status).toBe(200);
    expect(res.body.valid).toBe(true);
  });

  it("returns valid:false with errors when multipack qty is wrong", async () => {
    const source: BundleLookup = {
      bundle: {
        findFirst: vi.fn().mockResolvedValue({
          type: "multipack",
          config: { packQuantity: 6 },
          items: [],
        }),
      },
    };
    const app = buildApp(source);
    const res = await request(app)
      .post("/proxy/validate-cart")
      .send({
        slug: "six-pack",
        lines: [{ shopifyProductGid: "gid://x", quantity: 5 }],
      });
    expect(res.status).toBe(200);
    expect(res.body.valid).toBe(false);
    expect(res.body.errors[0]).toMatch(/exactly 6/);
  });

  it("400 when body is malformed", async () => {
    const source: BundleLookup = { bundle: { findFirst: vi.fn() } };
    const app = buildApp(source);
    const res = await request(app)
      .post("/proxy/validate-cart")
      .send({ slug: "x" });
    expect(res.status).toBe(400);
  });
});

describe("POST /proxy/validate-cart — plan order cap (M-200)", () => {
  it("rejects with order_cap_reached when Starter shop is over cap", async () => {
    const source: BundleLookup = {
      bundle: {
        findFirst: vi.fn().mockResolvedValue({
          type: "multipack",
          config: { packQuantity: 6 },
          items: [],
        }),
      },
    };
    const orderCap = vi.fn().mockResolvedValue({
      over: true,
      cap: 100,
      count: 100,
      plan: "starter",
    });
    const app = buildApp(source, true, { orderCap });
    const res = await request(app)
      .post("/proxy/validate-cart")
      .send({
        slug: "six-pack",
        lines: [{ shopifyProductGid: "gid://x", quantity: 6 }],
      });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      valid: false,
      errors: [
        "This shop has reached its monthly bundle order limit. Upgrade to Growth for unlimited orders.",
      ],
      code: "order_cap_reached",
    });
    // Bundle lookup must be skipped — the cap rejection short-circuits.
    expect(source.bundle.findFirst).not.toHaveBeenCalled();
  });

  it("allows the request through when Starter shop is under cap", async () => {
    const source: BundleLookup = {
      bundle: {
        findFirst: vi.fn().mockResolvedValue({
          type: "multipack",
          config: { packQuantity: 6 },
          items: [],
        }),
      },
    };
    const orderCap = vi.fn().mockResolvedValue({
      over: false,
      cap: 100,
      count: 47,
      plan: "starter",
    });
    const app = buildApp(source, true, { orderCap });
    const res = await request(app)
      .post("/proxy/validate-cart")
      .send({
        slug: "six-pack",
        lines: [{ shopifyProductGid: "gid://x", quantity: 6 }],
      });
    expect(res.status).toBe(200);
    expect(res.body.valid).toBe(true);
    expect(res.body.code).toBeUndefined();
  });

  it("ignores the cap on paid plans (Growth: cap=null)", async () => {
    const source: BundleLookup = {
      bundle: {
        findFirst: vi.fn().mockResolvedValue({
          type: "multipack",
          config: { packQuantity: 6 },
          items: [],
        }),
      },
    };
    const orderCap = vi.fn().mockResolvedValue({
      over: false,
      cap: null,
      count: 0,
      plan: "growth",
    });
    const app = buildApp(source, true, { orderCap });
    const res = await request(app)
      .post("/proxy/validate-cart")
      .send({
        slug: "six-pack",
        lines: [{ shopifyProductGid: "gid://x", quantity: 6 }],
      });
    expect(res.status).toBe(200);
    expect(res.body.valid).toBe(true);
  });

  it("treats orderCap=null (shop not found) as no cap", async () => {
    const source: BundleLookup = {
      bundle: {
        findFirst: vi.fn().mockResolvedValue({
          type: "multipack",
          config: { packQuantity: 6 },
          items: [],
        }),
      },
    };
    // Defensive: the storefront proxy is HMAC-verified upstream, but if
    // somehow the shop row is missing we should fail open (let the
    // request continue) so we don't break checkout for an
    // installed-but-mid-migration shop.
    const orderCap = vi.fn().mockResolvedValue(null);
    const app = buildApp(source, true, { orderCap });
    const res = await request(app)
      .post("/proxy/validate-cart")
      .send({
        slug: "six-pack",
        lines: [{ shopifyProductGid: "gid://x", quantity: 6 }],
      });
    expect(res.status).toBe(200);
    expect(res.body.valid).toBe(true);
  });
});
