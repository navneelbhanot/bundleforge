import { createHmac } from "node:crypto";

import express, { type Express } from "express";
import { describe, it, expect } from "vitest";
import request from "supertest";

import { errorHandler, requestId } from "./errorHandler";
import { appProxyAuth, verifyAppProxySignature } from "./appProxy";

const SECRET = "test-secret";

function signQuery(params: Record<string, string>): string {
  const sortedKeys = Object.keys(params).sort();
  const message = sortedKeys.map((k) => `${k}=${params[k]}`).join("");
  return createHmac("sha256", SECRET).update(message).digest("hex");
}

describe("verifyAppProxySignature", () => {
  it("accepts a correctly-signed query", () => {
    const params = { shop: "demo.myshopify.com", path_prefix: "/apps/bf", timestamp: "1700000000" };
    const signature = signQuery(params);
    expect(
      verifyAppProxySignature({ ...params, signature }, SECRET),
    ).toBe(true);
  });

  it("rejects when signature is wrong", () => {
    const params = { shop: "demo.myshopify.com", timestamp: "1" };
    expect(
      verifyAppProxySignature({ ...params, signature: "deadbeef" }, SECRET),
    ).toBe(false);
  });

  it("rejects when signature is missing", () => {
    expect(verifyAppProxySignature({ shop: "x" }, SECRET)).toBe(false);
  });

  it("array params are joined with comma before signing", () => {
    const params = { shop: "demo.myshopify.com", ids: "1,2,3" };
    const signature = signQuery(params);
    expect(
      verifyAppProxySignature({ shop: "demo.myshopify.com", ids: ["1", "2", "3"], signature }, SECRET),
    ).toBe(true);
  });
});

function buildApp(): Express {
  const app = express();
  app.use(requestId);
  app.get("/proxy/x", appProxyAuth({ secret: SECRET }), (req, res) => {
    res.json({ shop: req.shopifyShopDomain });
  });
  app.use(errorHandler);
  return app;
}

describe("appProxyAuth middleware", () => {
  it("calls next() with valid signature and exposes shop on req", async () => {
    const params = { shop: "demo.myshopify.com", timestamp: "1" };
    const signature = signQuery(params);
    const app = buildApp();
    const res = await request(app)
      .get("/proxy/x")
      .query({ ...params, signature });
    expect(res.status).toBe(200);
    expect(res.body.shop).toBe("demo.myshopify.com");
  });

  it("rejects with 401 on invalid signature", async () => {
    const app = buildApp();
    const res = await request(app)
      .get("/proxy/x")
      .query({ shop: "demo", signature: "bad" });
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("unauthorized");
  });
});
