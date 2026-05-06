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

const SHOP_BASE = {
  name: "Devstore",
  email: "owner@devstore.com",
  shopifyDomain: "devstore.myshopify.com",
  currency: "USD",
  locale: "en",
  timezone: "America/Los_Angeles",
} as const;

describe("GET /settings", () => {
  it("returns the shop's settings JSON merged with the General subobject", async () => {
    const client: SettingsClient = {
      shop: {
        findUnique: vi.fn().mockResolvedValue({
          ...SHOP_BASE,
          settings: { safetyLock: true },
        }),
        update: vi.fn(),
      },
    };
    const res = await request(buildApp(client)).get("/settings");
    expect(res.status).toBe(200);
    expect(res.body.safetyLock).toBe(true);
    expect(res.body.general).toMatchObject({
      name: "Devstore",
      email: "owner@devstore.com",
      shopifyDomain: "devstore.myshopify.com",
      currency: "USD",
      locale: "en",
      timezone: "America/Los_Angeles",
      brandColor: null,
      logoUrl: null,
    });
  });

  it("overlays settings.general overrides on top of Shop columns", async () => {
    const client: SettingsClient = {
      shop: {
        findUnique: vi.fn().mockResolvedValue({
          ...SHOP_BASE,
          settings: {
            general: {
              brandColor: "#1f5fa6",
              currency: "EUR",
              locale: "fr",
            },
          },
        }),
        update: vi.fn(),
      },
    };
    const res = await request(buildApp(client)).get("/settings");
    expect(res.status).toBe(200);
    expect(res.body.general.brandColor).toBe("#1f5fa6");
    expect(res.body.general.currency).toBe("EUR");
    expect(res.body.general.locale).toBe("fr");
    // Timezone wasn't overridden — still falls back to Shop column.
    expect(res.body.general.timezone).toBe("America/Los_Angeles");
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
  it("merges patch into existing settings (legacy safetyLock toggle)", async () => {
    const client: SettingsClient = {
      shop: {
        findUnique: vi
          .fn()
          .mockResolvedValueOnce({
            ...SHOP_BASE,
            settings: { safetyLock: false, other: "x" },
          })
          .mockResolvedValueOnce({
            ...SHOP_BASE,
            settings: { safetyLock: true, other: "x" },
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

  it("rejects unknown top-level keys via Zod strict mode", async () => {
    const client: SettingsClient = {
      shop: {
        findUnique: vi.fn().mockResolvedValue({ ...SHOP_BASE, settings: {} }),
        update: vi.fn(),
      },
    };
    const res = await request(buildApp(client))
      .put("/settings")
      .send({ safetyLock: "yes" });
    expect(res.status).toBe(400);
  });

  it("rejects malformed brand color (must be #rrggbb hex)", async () => {
    const client: SettingsClient = {
      shop: {
        findUnique: vi.fn().mockResolvedValue({ ...SHOP_BASE, settings: {} }),
        update: vi.fn(),
      },
    };
    const res = await request(buildApp(client))
      .put("/settings")
      .send({ general: { brandColor: "blue" } });
    expect(res.status).toBe(400);
  });

  it("persists a brandColor patch and round-trips it", async () => {
    const updateSpy = vi.fn().mockResolvedValue({
      id: "s",
      settings: { general: { brandColor: "#1f5fa6" } },
    });
    const client: SettingsClient = {
      shop: {
        findUnique: vi.fn().mockResolvedValue({
          ...SHOP_BASE,
          settings: {},
        }),
        update: updateSpy,
      },
    };
    const res = await request(buildApp(client))
      .put("/settings")
      .send({ general: { brandColor: "#1f5fa6" } });
    expect(res.status).toBe(200);
    expect(res.body.general.brandColor).toBe("#1f5fa6");
    const writtenSettings = updateSpy.mock.calls[0][0].data.settings;
    expect(writtenSettings.general.brandColor).toBe("#1f5fa6");
  });

  it("deep-merges general subobject — Brand-card save doesn't wipe Defaults-card values", async () => {
    const updateSpy = vi.fn().mockImplementation(({ data }) =>
      Promise.resolve({ id: "s", settings: data.settings }),
    );
    const client: SettingsClient = {
      shop: {
        findUnique: vi.fn().mockResolvedValue({
          ...SHOP_BASE,
          settings: {
            general: { currency: "EUR", locale: "de" },
          },
        }),
        update: updateSpy,
      },
    };
    const res = await request(buildApp(client))
      .put("/settings")
      .send({ general: { brandColor: "#1f5fa6" } });
    expect(res.status).toBe(200);
    const writtenSettings = updateSpy.mock.calls[0][0].data.settings;
    expect(writtenSettings.general).toEqual({
      currency: "EUR",
      locale: "de",
      brandColor: "#1f5fa6",
    });
  });

  it("persists top-level safetyLock and general.brandColor in the same patch", async () => {
    const updateSpy = vi.fn().mockImplementation(({ data }) =>
      Promise.resolve({ id: "s", settings: data.settings }),
    );
    const client: SettingsClient = {
      shop: {
        findUnique: vi.fn().mockResolvedValue({
          ...SHOP_BASE,
          settings: {},
        }),
        update: updateSpy,
      },
    };
    const res = await request(buildApp(client))
      .put("/settings")
      .send({
        safetyLock: true,
        general: { brandColor: "#abcdef" },
      });
    expect(res.status).toBe(200);
    const writtenSettings = updateSpy.mock.calls[0][0].data.settings;
    expect(writtenSettings.safetyLock).toBe(true);
    expect(writtenSettings.general.brandColor).toBe("#abcdef");
  });
});
