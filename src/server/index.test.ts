import { describe, it, expect } from "vitest";
import request from "supertest";

import { createApp } from "./index";

describe("createApp", () => {
  it("is a pure factory: each call returns a fresh Express instance", () => {
    const a = createApp();
    const b = createApp();
    expect(a).not.toBe(b);
  });
});

describe("GET /health", () => {
  it("returns 200 with status, version, and checks", async () => {
    const app = createApp();
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
    expect(typeof res.body.version).toBe("string");
    expect(res.body.checks).toBeDefined();
    expect("db" in res.body.checks).toBe(true);
    expect("redis" in res.body.checks).toBe(true);
    expect(typeof res.body.timestamp).toBe("string");
  });

  it("checks.db is a boolean (false here because no DB is connected)", async () => {
    const app = createApp();
    const res = await request(app).get("/health");
    expect(typeof res.body.checks.db).toBe("boolean");
  });

  it("checks.redis is a boolean (false here because no Redis is connected)", async () => {
    const app = createApp();
    const res = await request(app).get("/health");
    expect(typeof res.body.checks.redis).toBe("boolean");
  });
});

describe("404", () => {
  it("returns 404 JSON for unknown /api/* paths (the SPA catch-all skips /api/)", async () => {
    // Use an /api/ path: the SPA fallback regex `/^\/(?!api\/|health$).*/`
    // explicitly excludes /api/, so unknown /api/ paths fall through to
    // the 404 catch-all. Non-/api/ paths would match the SPA fallback
    // when dist/frontend exists.
    const app = createApp();
    const res = await request(app).get("/api/no-such-path");
    expect(res.status).toBe(404);
    expect(res.body.error.message).toBe("Not found");
  });
});
