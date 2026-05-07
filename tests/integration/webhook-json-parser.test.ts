/**
 * Regression test for M-209: ensures the global `express.json()`
 * body parser does NOT consume the request body for /api/webhooks
 * before the HMAC verifier reads it as raw bytes.
 *
 * Without the path-aware skip in src/server/index.ts, the global
 * parser eats the body, the verifier sees an empty Buffer, HMAC
 * fails, and Shopify gets 401 for every webhook delivery —
 * including app/uninstalled, which silently breaks token rotation.
 */
import { createHmac } from "node:crypto";

import express, { type Express } from "express";
import { describe, it, expect, vi } from "vitest";
import request from "supertest";

import { errorHandler, requestId } from "../../src/middleware/errorHandler";
import { mountWebhooks } from "../../src/webhooks";

const SECRET = "test-shopify-secret";
const sign = (raw: string): string =>
  createHmac("sha256", SECRET).update(raw).digest("base64");

/**
 * Mimic src/server/index.ts middleware order:
 *  1. requestId
 *  2. global express.json (path-aware skip on /api/webhooks)
 *  3. mountWebhooks
 *  4. errorHandler
 */
function buildAppLikeProduction(): Express {
  const app = express();
  app.use(requestId);
  // The actual fix from M-209 — replicate it here.
  app.use((req, _res, next) => {
    if (req.path === "/api/webhooks") return next();
    return express.json({ limit: "10mb" })(req, _res, next);
  });
  const queue = {
    add: vi.fn(async () => ({ id: "j-1" })),
  };
  mountWebhooks(app, {
    queue: queue as unknown as Parameters<typeof mountWebhooks>[1] extends infer T
      ? T extends { queue?: infer Q }
        ? Q
        : never
      : never,
    secret: SECRET,
  });
  app.use(errorHandler);
  return app;
}

describe("M-209: webhook body parser interaction", () => {
  it("accepts a valid HMAC-signed webhook even with global json() registered upstream", async () => {
    const app = buildAppLikeProduction();
    const payload = JSON.stringify({ id: 12345, shop: "demo.myshopify.com" });
    const res = await request(app)
      .post("/api/webhooks")
      .set("Content-Type", "application/json")
      .set("X-Shopify-Hmac-Sha256", sign(payload))
      .set("X-Shopify-Topic", "app/uninstalled")
      .set("X-Shopify-Shop-Domain", "demo.myshopify.com")
      .set("X-Shopify-Webhook-Id", "wh-1")
      .send(payload);
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });

  it("rejects with 401 when HMAC is bad (verifier still works after the skip)", async () => {
    const app = buildAppLikeProduction();
    const payload = JSON.stringify({ id: 12345 });
    const res = await request(app)
      .post("/api/webhooks")
      .set("Content-Type", "application/json")
      .set("X-Shopify-Hmac-Sha256", "definitely-not-a-real-hmac")
      .set("X-Shopify-Topic", "app/uninstalled")
      .set("X-Shopify-Shop-Domain", "demo.myshopify.com")
      .set("X-Shopify-Webhook-Id", "wh-2")
      .send(payload);
    expect(res.status).toBe(401);
  });

  /**
   * Sanity check: a *different* JSON route must still receive
   * its body parsed normally — we only skipped /api/webhooks.
   */
  it("non-webhook routes still get JSON-parsed bodies", async () => {
    const app = buildAppLikeProduction();
    let captured: unknown = null;
    app.post("/api/v1/echo", (req, res) => {
      captured = req.body;
      res.json({ ok: true });
    });
    const res = await request(app)
      .post("/api/v1/echo")
      .set("Content-Type", "application/json")
      .send({ hello: "world" });
    expect(res.status).toBe(200);
    expect(captured).toEqual({ hello: "world" });
  });
});
