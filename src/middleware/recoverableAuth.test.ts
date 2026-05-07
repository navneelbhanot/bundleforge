import express, { type Express } from "express";
import { describe, it, expect } from "vitest";
import request from "supertest";

import { recoverableAuth } from "./recoverableAuth";

function buildApp(throwingHandler: () => void): Express {
  const app = express();
  app.use(express.json());
  app.use("/api/v1/test", (_req, _res, next) => {
    try {
      throwingHandler();
    } catch (err) {
      next(err);
    }
  });
  app.use("/api/v1", recoverableAuth);
  // Fallback handler so non-auth errors get a known shape.
  app.use(((err: { message?: string }, _req, res, _next) => {
    res.status(500).json({ error: { message: err.message ?? "boom" } });
  }) as express.ErrorRequestHandler);
  return app;
}

class FakeHttpResponseError extends Error {
  constructor(public readonly response: { code: number; statusText: string }) {
    super("Received an error response from Shopify");
    this.name = "HttpResponseError";
  }
}

describe("recoverableAuth", () => {
  it("converts HttpResponseError 403 into 401 + reauthorize headers", async () => {
    const app = buildApp(() => {
      throw new FakeHttpResponseError({ code: 403, statusText: "Forbidden" });
    });
    const res = await request(app)
      .get("/api/v1/test")
      .query({ shop: "demo.myshopify.com" });
    expect(res.status).toBe(401);
    expect(res.headers["x-shopify-api-request-failure-reauthorize"]).toBe("1");
    expect(res.headers["x-shopify-api-request-failure-reauthorize-url"]).toBe(
      "/api/auth?shop=demo.myshopify.com",
    );
    expect(res.body.error.code).toBe("session_expired");
    expect(res.body.error.reauthorizeUrl).toBe(
      "/api/auth?shop=demo.myshopify.com",
    );
  });

  it("converts HttpResponseError 401 into 401 + reauthorize headers", async () => {
    const app = buildApp(() => {
      throw new FakeHttpResponseError({
        code: 401,
        statusText: "Unauthorized",
      });
    });
    const res = await request(app)
      .get("/api/v1/test")
      .query({ shop: "demo.myshopify.com" });
    expect(res.status).toBe(401);
    expect(res.headers["x-shopify-api-request-failure-reauthorize"]).toBe("1");
  });

  it("falls through to the next error handler for non-auth errors", async () => {
    const app = buildApp(() => {
      throw new Error("something else");
    });
    const res = await request(app).get("/api/v1/test");
    expect(res.status).toBe(500);
    expect(res.body.error.message).toBe("something else");
    expect(res.headers["x-shopify-api-request-failure-reauthorize"]).toBeUndefined();
  });

  it("falls through for HttpResponseError with non-auth status code", async () => {
    const app = buildApp(() => {
      throw new FakeHttpResponseError({ code: 500, statusText: "Internal" });
    });
    const res = await request(app).get("/api/v1/test");
    expect(res.status).toBe(500);
    expect(res.headers["x-shopify-api-request-failure-reauthorize"]).toBeUndefined();
  });

  it("derives shop from the JWT dest claim when query is missing", async () => {
    const app = buildApp(() => {
      throw new FakeHttpResponseError({ code: 403, statusText: "Forbidden" });
    });
    // Build a fake App Bridge JWT (header.payload.signature, base64url).
    const header = Buffer.from(JSON.stringify({ alg: "HS256" })).toString(
      "base64url",
    );
    const payload = Buffer.from(
      JSON.stringify({ dest: "https://demo.myshopify.com" }),
    ).toString("base64url");
    const sig = "fakesig";
    const jwt = `${header}.${payload}.${sig}`;
    const res = await request(app)
      .get("/api/v1/test")
      .set("Authorization", `Bearer ${jwt}`);
    expect(res.headers["x-shopify-api-request-failure-reauthorize-url"]).toBe(
      "/api/auth?shop=demo.myshopify.com",
    );
  });

  it("falls back to /api/auth without ?shop when no signal exists", async () => {
    const app = buildApp(() => {
      throw new FakeHttpResponseError({ code: 401, statusText: "Unauth" });
    });
    const res = await request(app).get("/api/v1/test");
    expect(res.headers["x-shopify-api-request-failure-reauthorize-url"]).toBe(
      "/api/auth",
    );
  });
});
