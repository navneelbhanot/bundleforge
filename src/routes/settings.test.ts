import express, { type Express } from "express";
import { describe, it, expect, vi } from "vitest";
import request from "supertest";

import { errorHandler, requestId } from "../middleware/errorHandler";
import { installSettingsRoutes, type SettingsClient } from "./settings";

function buildApp(client: SettingsClient): Express {
  const app = express();
  app.use(requestId);
  app.use(express.json());
  app.use((req, _res, next) => {
    req.shopId = "shop-uuid";
    next();
  });
  app.use("/settings", installSettingsRoutes({ client }));
  app.use(errorHandler);
  return app;
}

describe("GET /settings", () => {
  it("returns the shop's settings JSON", async () => {
    const client: SettingsClient = {
      shop: {
        findUnique: vi.fn().mockResolvedValue({
          settings: { safetyLock: true },
        }),
        update: vi.fn(),
      },
    };
    const res = await request(buildApp(client)).get("/settings");
    expect(res.status).toBe(200);
    expect(res.body.safetyLock).toBe(true);
  });

  it("404 when shop not found", async () => {
    const client: SettingsClient = {
      shop: { findUnique: vi.fn().mockResolvedValue(null), update: vi.fn() },
    };
    const res = await request(buildApp(client)).get("/settings");
    expect(res.status).toBe(404);
  });
});

describe("PUT /settings", () => {
  it("merges patch into existing settings", async () => {
    const client: SettingsClient = {
      shop: {
        findUnique: vi.fn().mockResolvedValue({
          settings: { safetyLock: false, other: "x" },
        }),
        update: vi.fn().mockResolvedValue({
          id: "s",
          settings: { safetyLock: true, other: "x" },
        }),
      },
    };
    const res = await request(buildApp(client))
      .put("/settings")
      .send({ safetyLock: true });
    expect(res.status).toBe(200);
    expect(res.body.safetyLock).toBe(true);
    expect(res.body.other).toBe("x");
  });

  it("rejects unknown keys via Zod", async () => {
    const client: SettingsClient = {
      shop: {
        findUnique: vi.fn().mockResolvedValue({ settings: {} }),
        update: vi.fn(),
      },
    };
    // Zod schema doesn't allow `safetyLock: "yes"` — must be boolean.
    const res = await request(buildApp(client))
      .put("/settings")
      .send({ safetyLock: "yes" });
    expect(res.status).toBe(400);
  });
});
