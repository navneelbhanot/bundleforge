import express, { type Express } from "express";
import { describe, it, expect } from "vitest";
import request from "supertest";
import { z } from "zod";

import {
  AppError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
  RateLimitError,
  UnauthorizedError,
  ValidationError,
} from "./errors";
import { errorHandler, requestId } from "./errorHandler";

function buildApp(handler: express.RequestHandler): Express {
  const app = express();
  app.use(requestId);
  app.get("/x", handler);
  app.use(errorHandler);
  return app;
}

describe("requestId middleware", () => {
  it("attaches a UUID as req.id and X-Request-Id header", async () => {
    const app = buildApp((req, res) => {
      res.json({ id: req.id });
    });
    const res = await request(app).get("/x");
    expect(res.status).toBe(200);
    expect(res.body.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(res.headers["x-request-id"]).toBe(res.body.id);
  });

  it("respects an incoming X-Request-Id header", async () => {
    const app = buildApp((req, res) => {
      res.json({ id: req.id });
    });
    const res = await request(app).get("/x").set("X-Request-Id", "custom-123");
    expect(res.body.id).toBe("custom-123");
    expect(res.headers["x-request-id"]).toBe("custom-123");
  });
});

describe("errorHandler — AppError taxonomy", () => {
  const cases: Array<[string, () => Error, number, string]> = [
    ["NotFoundError → 404", () => new NotFoundError("Bundle"), 404, "not_found"],
    [
      "ValidationError → 400",
      () => new ValidationError("title is required"),
      400,
      "validation_error",
    ],
    ["UnauthorizedError → 401", () => new UnauthorizedError(), 401, "unauthorized"],
    ["ForbiddenError → 403", () => new ForbiddenError(), 403, "forbidden"],
    ["ConflictError → 409", () => new ConflictError("slug taken"), 409, "conflict"],
    ["RateLimitError → 429", () => new RateLimitError(60), 429, "rate_limited"],
  ];

  for (const [label, build, status, code] of cases) {
    it(label, async () => {
      const app = buildApp((_req, _res, next) => next(build()));
      const res = await request(app).get("/x");
      expect(res.status).toBe(status);
      expect(res.body.error.code).toBe(code);
      expect(res.body.error.statusCode).toBe(status);
      expect(res.body.error.requestId).toMatch(/^[0-9a-f-]{36}$/);
    });
  }

  it("includes details when AppError carries them", async () => {
    const app = buildApp((_req, _res, next) =>
      next(new ValidationError("bad", { field: "title" })),
    );
    const res = await request(app).get("/x");
    expect(res.body.error.details).toEqual({ field: "title" });
  });
});

describe("errorHandler — Zod errors", () => {
  it("flattens ZodError into a 400 with field errors", async () => {
    const schema = z.object({ title: z.string() });
    const app = buildApp((_req, _res, next) => {
      const result = schema.safeParse({});
      if (!result.success) next(result.error);
      else next(new Error("schema unexpectedly accepted empty"));
    });
    const res = await request(app).get("/x");
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("validation_error");
    expect(res.body.error.details.fieldErrors.title).toBeDefined();
  });
});

describe("errorHandler — unknown errors", () => {
  it("returns 500 with code 'internal_error'", async () => {
    const app = buildApp((_req, _res, next) => next(new Error("kaboom")));
    const res = await request(app).get("/x");
    expect(res.status).toBe(500);
    expect(res.body.error.code).toBe("internal_error");
    expect(res.body.error.requestId).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("returns 500 even when next() is called with a non-Error", async () => {
    const app = buildApp((_req, _res, next) => next("string thrown" as unknown as Error));
    const res = await request(app).get("/x");
    expect(res.status).toBe(500);
  });
});

describe("AppError direct construction", () => {
  it("retains all options and isOperational flag", () => {
    const err = new AppError({
      message: "x",
      statusCode: 418,
      code: "teapot",
      details: { tea: "earl grey" },
    });
    expect(err.statusCode).toBe(418);
    expect(err.code).toBe("teapot");
    expect(err.details).toEqual({ tea: "earl grey" });
    expect(err.isOperational).toBe(true);
  });
});
