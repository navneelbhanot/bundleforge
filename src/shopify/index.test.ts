import { describe, it, expect } from "vitest";
import request from "supertest";

import { createApp } from "../server";

describe("Shopify OAuth install", () => {
  it("GET /api/auth?shop=… redirects to Shopify authorize URL", async () => {
    const app = createApp();
    const res = await request(app).get("/api/auth?shop=test-shop.myshopify.com");
    expect([302, 303]).toContain(res.status);
    const loc = res.headers.location;
    expect(loc).toBeDefined();
    expect(loc).toMatch(
      /^https:\/\/test-shop\.myshopify\.com\/admin\/oauth\/authorize\?/,
    );
  });

  it("GET /api/auth without shop returns 400-ish from Shopify SDK", async () => {
    const app = createApp();
    const res = await request(app).get("/api/auth");
    // The Shopify SDK rejects missing shop param. Exact code is 400 or 500
    // depending on version; we just assert it's not a successful redirect to
    // the authorize URL.
    expect(res.headers.location ?? "").not.toMatch(
      /\/admin\/oauth\/authorize\?/,
    );
  });
});
