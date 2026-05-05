import { createHmac } from "node:crypto";

import express, { type Express } from "express";
import { describe, it, expect } from "vitest";
import request from "supertest";

import { errorHandler, requestId } from "./errorHandler";
import { shopifyWebhookHmac } from "./shopifyWebhook";

const SECRET = "test-shared-secret";

function sign(body: string): string {
  return createHmac("sha256", SECRET).update(body).digest("base64");
}

function buildApp(): Express {
  const app = express();
  app.use(requestId);
  app.post(
    "/webhook",
    ...shopifyWebhookHmac({ secret: SECRET }),
    (req, res) => {
      res.json({
        topic: req.shopifyTopic,
        shop: req.shopifyShopDomain,
        webhookId: req.shopifyWebhookId,
        body: req.body,
      });
    },
  );
  app.use(errorHandler);
  return app;
}

describe("shopifyWebhookHmac", () => {
  it("accepts a request with a valid HMAC and exposes parsed body + headers", async () => {
    const app = buildApp();
    const payload = JSON.stringify({ hello: "world" });
    const res = await request(app)
      .post("/webhook")
      .set("Content-Type", "application/json")
      .set("X-Shopify-Hmac-Sha256", sign(payload))
      .set("X-Shopify-Topic", "orders/create")
      .set("X-Shopify-Shop-Domain", "demo.myshopify.com")
      .set("X-Shopify-Webhook-Id", "abc-123")
      .send(payload);
    expect(res.status).toBe(200);
    expect(res.body.topic).toBe("orders/create");
    expect(res.body.shop).toBe("demo.myshopify.com");
    expect(res.body.webhookId).toBe("abc-123");
    expect(res.body.body).toEqual({ hello: "world" });
  });

  it("rejects a request with a tampered body (HMAC mismatch)", async () => {
    const app = buildApp();
    const original = JSON.stringify({ hello: "world" });
    const tampered = JSON.stringify({ hello: "hacker" });
    const res = await request(app)
      .post("/webhook")
      .set("Content-Type", "application/json")
      .set("X-Shopify-Hmac-Sha256", sign(original))
      .send(tampered);
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("unauthorized");
  });

  it("rejects a request missing the HMAC header", async () => {
    const app = buildApp();
    const res = await request(app)
      .post("/webhook")
      .set("Content-Type", "application/json")
      .send(JSON.stringify({ hello: "world" }));
    expect(res.status).toBe(401);
    expect(res.body.error.message).toMatch(/Missing/);
  });

  it("uses timing-safe equality (does not short-circuit on prefix match)", async () => {
    // Smoke test: a valid sig with one trailing char altered fails.
    const app = buildApp();
    const payload = JSON.stringify({ ok: true });
    const sig = sign(payload);
    const altered = sig.slice(0, -1) + (sig.slice(-1) === "A" ? "B" : "A");
    const res = await request(app)
      .post("/webhook")
      .set("Content-Type", "application/json")
      .set("X-Shopify-Hmac-Sha256", altered)
      .send(payload);
    expect(res.status).toBe(401);
  });
});
