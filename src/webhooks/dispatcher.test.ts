import { createHmac } from "node:crypto";

import express, { type Express } from "express";
import { describe, it, expect, vi } from "vitest";
import request from "supertest";

import { errorHandler, requestId } from "../middleware/errorHandler";
import { mountWebhooks, type WebhookJobData } from "./index";

const SECRET = "shared-secret";

function sign(body: string): string {
  return createHmac("sha256", SECRET).update(body).digest("base64");
}

interface FakeQueue {
  add: ReturnType<typeof vi.fn>;
}

function buildApp(queue: FakeQueue): Express {
  const app = express();
  app.use(requestId);
  mountWebhooks(app, {
    queue: queue as unknown as NonNullable<
      Parameters<typeof mountWebhooks>[1]
    >["queue"],
    secret: SECRET,
  });
  app.use(errorHandler);
  return app;
}

describe("webhook dispatcher", () => {
  it("enqueues a verified webhook with topic name and webhookId as jobId", async () => {
    const queue: FakeQueue = { add: vi.fn().mockResolvedValue({ id: "job-1" }) };
    const app = buildApp(queue);
    const payload = JSON.stringify({ id: 12345 });
    const res = await request(app)
      .post("/api/webhooks")
      .set("Content-Type", "application/json")
      .set("X-Shopify-Hmac-Sha256", sign(payload))
      .set("X-Shopify-Topic", "orders/create")
      .set("X-Shopify-Shop-Domain", "demo.myshopify.com")
      .set("X-Shopify-Webhook-Id", "wh-1")
      .send(payload);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
    expect(queue.add).toHaveBeenCalledTimes(1);
    const [name, data, opts] = queue.add.mock.calls[0];
    expect(name).toBe("orders/create");
    const typed = data as WebhookJobData;
    expect(typed.topic).toBe("orders/create");
    expect(typed.shopDomain).toBe("demo.myshopify.com");
    expect(typed.webhookId).toBe("wh-1");
    expect(typed.payload).toEqual({ id: 12345 });
    expect((opts as { jobId: string }).jobId).toBe("wh-1");
  });

  it("rejects 401 without enqueuing on invalid HMAC", async () => {
    const queue: FakeQueue = { add: vi.fn() };
    const app = buildApp(queue);
    const res = await request(app)
      .post("/api/webhooks")
      .set("Content-Type", "application/json")
      .set("X-Shopify-Hmac-Sha256", "wrong")
      .set("X-Shopify-Topic", "orders/create")
      .send(JSON.stringify({}));
    expect(res.status).toBe(401);
    expect(queue.add).not.toHaveBeenCalled();
  });
});
