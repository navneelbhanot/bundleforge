/**
 * M-138 — Webhook dispatcher throughput property test.
 *
 * Synthetic: pushes N webhooks at the dispatcher and measures
 * latency. Each ack must come back within a generous local budget;
 * we don't claim production-throughput numbers — the goal is to
 * catch regressions where the dispatcher accidentally serializes or
 * blocks on something async.
 */
import { createHmac } from "node:crypto";

import express, { type Express } from "express";
import { describe, it, expect, vi } from "vitest";
import request from "supertest";

import { errorHandler, requestId } from "../../src/middleware/errorHandler";
import { mountWebhooks } from "../../src/webhooks";

const SECRET = "throughput-secret";

function sign(body: string): string {
  return createHmac("sha256", SECRET).update(body).digest("base64");
}

function build(): { app: Express; addCalls: number[] } {
  const addCalls: number[] = [];
  const queue = {
    add: vi.fn(async (_name: string, _data: unknown) => {
      addCalls.push(Date.now());
      return { id: `j-${addCalls.length}` };
    }),
  };
  const app = express();
  app.use(requestId);
  mountWebhooks(app, {
    queue: queue as unknown as Parameters<typeof mountWebhooks>[1] extends infer T
      ? T extends { queue?: infer Q }
        ? Q
        : never
      : never,
    secret: SECRET,
  });
  app.use(errorHandler);
  return { app, addCalls };
}

describe("webhook dispatcher throughput (M-138)", () => {
  it("acks 100 webhooks quickly and enqueues all of them", async () => {
    const { app, addCalls } = build();
    const N = 100;
    const start = Date.now();
    const promises: Promise<unknown>[] = [];
    for (let i = 0; i < N; i++) {
      const payload = JSON.stringify({ id: i });
      promises.push(
        request(app)
          .post("/api/webhooks")
          .set("Content-Type", "application/json")
          .set("X-Shopify-Hmac-Sha256", sign(payload))
          .set("X-Shopify-Topic", "orders/create")
          .set("X-Shopify-Shop-Domain", "demo.myshopify.com")
          .set("X-Shopify-Webhook-Id", `wh-${i}`)
          .send(payload),
      );
    }
    const responses = await Promise.all(promises);
    const elapsed = Date.now() - start;
    expect(responses.every((r) => r.status === 200)).toBe(true);
    expect(addCalls.length).toBe(N);
    // Generous budget for vitest in CI: 5 seconds for 100 in-process calls.
    expect(elapsed).toBeLessThan(5000);
  });
});
