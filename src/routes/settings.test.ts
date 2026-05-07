import express, { type Express } from "express";
import { describe, it, expect, vi } from "vitest";
import request from "supertest";
import type { Session } from "@shopify/shopify-api";

import { errorHandler, requestId } from "../middleware/errorHandler";
import {
  installSettingsRoutes,
  type SettingsClient,
  type SettingsDeps,
} from "./settings";

interface BuildOpts {
  writeShopMetafieldImpl?: SettingsDeps["writeShopMetafieldImpl"];
  withSession?: boolean;
}

function buildApp(client: SettingsClient, opts: BuildOpts = {}): Express {
  const { withSession = true, writeShopMetafieldImpl } = opts;
  const app = express();
  app.use(requestId);
  app.use(express.json());
  app.use((req, res, next) => {
    req.shopId = "shop-uuid";
    if (withSession) {
      const locals = res.locals as { shopify?: { session?: Session } };
      locals.shopify = {
        session: { shop: "devstore.myshopify.com" } as unknown as Session,
      };
    }
    next();
  });
  app.use(
    "/settings",
    installSettingsRoutes({
      client,
      ...(writeShopMetafieldImpl && { writeShopMetafieldImpl }),
    }),
  );
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

  it("round-trips a display patch", async () => {
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
        display: {
          layout: "carousel",
          colorPreset: "high-contrast",
          imagePreference: "bundle_hero",
          addToCartCopy: "Grab the bundle",
          soldOutBehavior: "waitlist",
        },
      });
    expect(res.status).toBe(200);
    expect(res.body.display).toMatchObject({
      layout: "carousel",
      colorPreset: "high-contrast",
      imagePreference: "bundle_hero",
      addToCartCopy: "Grab the bundle",
      soldOutBehavior: "waitlist",
    });
  });

  it("rejects an unknown display.layout enum value", async () => {
    const client: SettingsClient = {
      shop: {
        findUnique: vi.fn().mockResolvedValue({
          ...SHOP_BASE,
          settings: {},
        }),
        update: vi.fn(),
      },
    };
    const res = await request(buildApp(client))
      .put("/settings")
      .send({ display: { layout: "weird" } });
    expect(res.status).toBe(400);
  });

  it("rejects display.cssOverride longer than 8000 chars", async () => {
    const client: SettingsClient = {
      shop: {
        findUnique: vi.fn().mockResolvedValue({
          ...SHOP_BASE,
          settings: {},
        }),
        update: vi.fn(),
      },
    };
    const res = await request(buildApp(client))
      .put("/settings")
      .send({ display: { cssOverride: "x".repeat(8001) } });
    expect(res.status).toBe(400);
  });

  it("deep-merges display — Layout-card save doesn't drop CSS-card values", async () => {
    const updateSpy = vi.fn().mockImplementation(({ data }) =>
      Promise.resolve({ id: "s", settings: data.settings }),
    );
    const client: SettingsClient = {
      shop: {
        findUnique: vi.fn().mockResolvedValue({
          ...SHOP_BASE,
          settings: {
            display: {
              cssOverride: ".bf-bundle{ color: red; }",
              colorPreset: "minimal",
            },
          },
        }),
        update: updateSpy,
      },
    };
    const res = await request(buildApp(client))
      .put("/settings")
      .send({ display: { layout: "list" } });
    expect(res.status).toBe(200);
    const writtenSettings = updateSpy.mock.calls[0][0].data.settings;
    expect(writtenSettings.display).toEqual({
      cssOverride: ".bf-bundle{ color: red; }",
      colorPreset: "minimal",
      layout: "list",
    });
  });

  it("round-trips a full inventory patch", async () => {
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
        inventory: {
          lowStockThreshold: 10,
          oversellPolicy: "allow_to_zero",
          auditRetentionDays: 90,
          snapshotFrequency: "every_6h",
          lowStockAlertEnabled: true,
        },
      });
    expect(res.status).toBe(200);
    expect(res.body.inventory).toMatchObject({
      lowStockThreshold: 10,
      oversellPolicy: "allow_to_zero",
      auditRetentionDays: 90,
      snapshotFrequency: "every_6h",
      lowStockAlertEnabled: true,
    });
  });

  it("rejects an unknown inventory.oversellPolicy enum value", async () => {
    const client: SettingsClient = {
      shop: {
        findUnique: vi.fn().mockResolvedValue({ ...SHOP_BASE, settings: {} }),
        update: vi.fn(),
      },
    };
    const res = await request(buildApp(client))
      .put("/settings")
      .send({ inventory: { oversellPolicy: "weird" } });
    expect(res.status).toBe(400);
  });

  it("rejects auditRetentionDays below the 7-day floor", async () => {
    const client: SettingsClient = {
      shop: {
        findUnique: vi.fn().mockResolvedValue({ ...SHOP_BASE, settings: {} }),
        update: vi.fn(),
      },
    };
    const res = await request(buildApp(client))
      .put("/settings")
      .send({ inventory: { auditRetentionDays: 5 } });
    expect(res.status).toBe(400);
  });

  it("round-trips a pricing patch with negative B2B markup", async () => {
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
        pricing: {
          roundingRule: "ninety_nine",
          currencyFormatterOverride: "{amount} {currency}",
          b2bMarkupPercent: -10,
          defaultDiscountType: "percentage",
        },
      });
    expect(res.status).toBe(200);
    expect(res.body.pricing).toMatchObject({
      roundingRule: "ninety_nine",
      b2bMarkupPercent: -10,
      defaultDiscountType: "percentage",
    });
  });

  it("rejects an unknown pricing.roundingRule enum value", async () => {
    const client: SettingsClient = {
      shop: {
        findUnique: vi.fn().mockResolvedValue({ ...SHOP_BASE, settings: {} }),
        update: vi.fn(),
      },
    };
    const res = await request(buildApp(client))
      .put("/settings")
      .send({ pricing: { roundingRule: "weird" } });
    expect(res.status).toBe(400);
  });

  it("deep-merges inventory — threshold save doesn't drop oversellPolicy", async () => {
    const updateSpy = vi.fn().mockImplementation(({ data }) =>
      Promise.resolve({ id: "s", settings: data.settings }),
    );
    const client: SettingsClient = {
      shop: {
        findUnique: vi.fn().mockResolvedValue({
          ...SHOP_BASE,
          settings: {
            inventory: {
              oversellPolicy: "prevent",
              snapshotFrequency: "daily",
            },
          },
        }),
        update: updateSpy,
      },
    };
    const res = await request(buildApp(client))
      .put("/settings")
      .send({ inventory: { lowStockThreshold: 5 } });
    expect(res.status).toBe(200);
    const writtenSettings = updateSpy.mock.calls[0][0].data.settings;
    expect(writtenSettings.inventory).toEqual({
      oversellPolicy: "prevent",
      snapshotFrequency: "daily",
      lowStockThreshold: 5,
    });
  });

  it("round-trips a full cart patch", async () => {
    const updateSpy = vi.fn().mockImplementation(({ data }) =>
      Promise.resolve({ id: "s", settings: data.settings }),
    );
    const client: SettingsClient = {
      shop: {
        findUnique: vi.fn().mockResolvedValue({ ...SHOP_BASE, settings: {} }),
        update: updateSpy,
      },
    };
    const res = await request(buildApp(client))
      .put("/settings")
      .send({
        cart: {
          defaultMode: "components_as_attributes",
          atomicCheckoutEnforcement: "warn",
          abandonmentBehavior: "prompt_user",
          cartNoteTemplate: "Bundle: {bundle_title} ({components_count} items)",
        },
      });
    expect(res.status).toBe(200);
    expect(res.body.cart).toMatchObject({
      defaultMode: "components_as_attributes",
      atomicCheckoutEnforcement: "warn",
      abandonmentBehavior: "prompt_user",
      cartNoteTemplate: "Bundle: {bundle_title} ({components_count} items)",
    });
  });

  it("rejects an unknown cart.defaultMode enum value", async () => {
    const client: SettingsClient = {
      shop: {
        findUnique: vi.fn().mockResolvedValue({ ...SHOP_BASE, settings: {} }),
        update: vi.fn(),
      },
    };
    const res = await request(buildApp(client))
      .put("/settings")
      .send({ cart: { defaultMode: "weird" } });
    expect(res.status).toBe(400);
  });

  it("rejects cartNoteTemplate longer than 280 chars", async () => {
    const client: SettingsClient = {
      shop: {
        findUnique: vi.fn().mockResolvedValue({ ...SHOP_BASE, settings: {} }),
        update: vi.fn(),
      },
    };
    const res = await request(buildApp(client))
      .put("/settings")
      .send({ cart: { cartNoteTemplate: "x".repeat(281) } });
    expect(res.status).toBe(400);
  });

  it("deep-merges cart — defaultMode save doesn't drop atomicCheckoutEnforcement", async () => {
    const updateSpy = vi.fn().mockImplementation(({ data }) =>
      Promise.resolve({ id: "s", settings: data.settings }),
    );
    const client: SettingsClient = {
      shop: {
        findUnique: vi.fn().mockResolvedValue({
          ...SHOP_BASE,
          settings: {
            cart: {
              atomicCheckoutEnforcement: "strict",
              abandonmentBehavior: "keep_selections",
            },
          },
        }),
        update: updateSpy,
      },
    };
    const res = await request(buildApp(client))
      .put("/settings")
      .send({ cart: { defaultMode: "components_as_attributes" } });
    expect(res.status).toBe(200);
    const writtenSettings = updateSpy.mock.calls[0][0].data.settings;
    expect(writtenSettings.cart).toEqual({
      atomicCheckoutEnforcement: "strict",
      abandonmentBehavior: "keep_selections",
      defaultMode: "components_as_attributes",
    });
  });

  it("round-trips a full notifications patch with channels + rules", async () => {
    const updateSpy = vi.fn().mockImplementation(({ data }) =>
      Promise.resolve({ id: "s", settings: data.settings }),
    );
    const client: SettingsClient = {
      shop: {
        findUnique: vi.fn().mockResolvedValue({ ...SHOP_BASE, settings: {} }),
        update: updateSpy,
      },
    };
    const res = await request(buildApp(client))
      .put("/settings")
      .send({
        notifications: {
          email: true,
          inApp: true,
          recipients: ["ops@example.com", "oncall@example.com"],
          slackWebhookUrl: "https://hooks.slack.com/services/T/B/X",
          rules: {
            lowStock: { enabled: true, channels: ["email", "slack"] },
            publishFailure: { enabled: true, channels: ["email"] },
          },
        },
      });
    expect(res.status, res.text).toBe(200);
    expect(res.body.notifications).toMatchObject({
      email: true,
      recipients: ["ops@example.com", "oncall@example.com"],
      slackWebhookUrl: "https://hooks.slack.com/services/T/B/X",
    });
    expect(res.body.notifications.rules.lowStock).toEqual({
      enabled: true,
      channels: ["email", "slack"],
    });
  });

  it("rejects a non-email entry in recipients", async () => {
    const client: SettingsClient = {
      shop: {
        findUnique: vi.fn().mockResolvedValue({ ...SHOP_BASE, settings: {} }),
        update: vi.fn(),
      },
    };
    const res = await request(buildApp(client))
      .put("/settings")
      .send({ notifications: { recipients: ["ops@example.com", "not-an-email"] } });
    expect(res.status).toBe(400);
  });

  it("rejects a slackWebhookUrl that isn't a URL", async () => {
    const client: SettingsClient = {
      shop: {
        findUnique: vi.fn().mockResolvedValue({ ...SHOP_BASE, settings: {} }),
        update: vi.fn(),
      },
    };
    const res = await request(buildApp(client))
      .put("/settings")
      .send({ notifications: { slackWebhookUrl: "not-a-url" } });
    expect(res.status).toBe(400);
  });

  it("rejects a recipients list with > 20 entries", async () => {
    const client: SettingsClient = {
      shop: {
        findUnique: vi.fn().mockResolvedValue({ ...SHOP_BASE, settings: {} }),
        update: vi.fn(),
      },
    };
    const recipients = Array.from(
      { length: 21 },
      (_, i) => `user${i}@example.com`,
    );
    const res = await request(buildApp(client))
      .put("/settings")
      .send({ notifications: { recipients } });
    expect(res.status).toBe(400);
  });

  it("deep-merges notifications.rules — saving lowStock doesn't drop publishFailure", async () => {
    const updateSpy = vi.fn().mockImplementation(({ data }) =>
      Promise.resolve({ id: "s", settings: data.settings }),
    );
    const client: SettingsClient = {
      shop: {
        findUnique: vi.fn().mockResolvedValue({
          ...SHOP_BASE,
          settings: {
            notifications: {
              email: true,
              rules: {
                publishFailure: { enabled: true, channels: ["email"] },
              },
            },
          },
        }),
        update: updateSpy,
      },
    };
    const res = await request(buildApp(client))
      .put("/settings")
      .send({
        notifications: {
          rules: { lowStock: { enabled: true, channels: ["slack"] } },
        },
      });
    expect(res.status, res.text).toBe(200);
    const writtenSettings = updateSpy.mock.calls[0][0].data.settings;
    expect(writtenSettings.notifications.email).toBe(true);
    expect(writtenSettings.notifications.rules.publishFailure).toEqual({
      enabled: true,
      channels: ["email"],
    });
    expect(writtenSettings.notifications.rules.lowStock).toEqual({
      enabled: true,
      channels: ["slack"],
    });
  });

  it("recipients save doesn't drop a previously saved email: true", async () => {
    const updateSpy = vi.fn().mockImplementation(({ data }) =>
      Promise.resolve({ id: "s", settings: data.settings }),
    );
    const client: SettingsClient = {
      shop: {
        findUnique: vi.fn().mockResolvedValue({
          ...SHOP_BASE,
          settings: { notifications: { email: true, inApp: false } },
        }),
        update: updateSpy,
      },
    };
    const res = await request(buildApp(client))
      .put("/settings")
      .send({
        notifications: { recipients: ["ops@example.com"] },
      });
    expect(res.status).toBe(200);
    const writtenSettings = updateSpy.mock.calls[0][0].data.settings;
    expect(writtenSettings.notifications).toMatchObject({
      email: true,
      inApp: false,
      recipients: ["ops@example.com"],
    });
  });

  it("round-trips a localization patch", async () => {
    const updateSpy = vi.fn().mockImplementation(({ data }) =>
      Promise.resolve({ id: "s", settings: data.settings }),
    );
    const client: SettingsClient = {
      shop: {
        findUnique: vi.fn().mockResolvedValue({ ...SHOP_BASE, settings: {} }),
        update: updateSpy,
      },
    };
    const res = await request(buildApp(client))
      .put("/settings")
      .send({
        localization: {
          enabledLocales: ["en", "fr", "de", "ja"],
          fallbackLocale: "en",
          machineTranslateMissing: true,
        },
      });
    expect(res.status, res.text).toBe(200);
    expect(res.body.localization).toMatchObject({
      enabledLocales: ["en", "fr", "de", "ja"],
      fallbackLocale: "en",
      machineTranslateMissing: true,
    });
  });

  it("rejects an unsupported locale in localization.fallbackLocale", async () => {
    const client: SettingsClient = {
      shop: {
        findUnique: vi.fn().mockResolvedValue({ ...SHOP_BASE, settings: {} }),
        update: vi.fn(),
      },
    };
    const res = await request(buildApp(client))
      .put("/settings")
      .send({ localization: { fallbackLocale: "klingon" } });
    expect(res.status).toBe(400);
  });

  it("deep-merges localization — fallback save doesn't drop enabledLocales", async () => {
    const updateSpy = vi.fn().mockImplementation(({ data }) =>
      Promise.resolve({ id: "s", settings: data.settings }),
    );
    const client: SettingsClient = {
      shop: {
        findUnique: vi.fn().mockResolvedValue({
          ...SHOP_BASE,
          settings: {
            localization: {
              enabledLocales: ["en", "es", "fr"],
              machineTranslateMissing: false,
            },
          },
        }),
        update: updateSpy,
      },
    };
    const res = await request(buildApp(client))
      .put("/settings")
      .send({ localization: { fallbackLocale: "es" } });
    expect(res.status).toBe(200);
    const writtenSettings = updateSpy.mock.calls[0][0].data.settings;
    expect(writtenSettings.localization).toEqual({
      enabledLocales: ["en", "es", "fr"],
      machineTranslateMissing: false,
      fallbackLocale: "es",
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

describe("Saved views (M-176)", () => {
  it("GET /settings exposes savedViews defaulting to []", async () => {
    const client: SettingsClient = {
      shop: {
        findUnique: vi.fn().mockResolvedValue({
          ...SHOP_BASE,
          settings: {},
        }),
        update: vi.fn(),
      },
    };
    const res = await request(buildApp(client)).get("/settings");
    expect(res.status).toBe(200);
    expect(res.body.savedViews).toEqual([]);
  });

  it("PUT /settings persists a valid savedViews array (whole-array replace)", async () => {
    const updateSpy = vi.fn().mockResolvedValue({
      id: "shop-uuid",
      settings: {
        savedViews: [
          {
            id: "v1",
            label: "Active drafts",
            filters: { status: "draft" },
          },
        ],
      },
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
      .send({
        savedViews: [
          {
            id: "v1",
            label: "Active drafts",
            filters: { status: "draft" },
            sort: { sortBy: "createdAt", sortOrder: "desc" },
          },
        ],
      });
    expect(res.status).toBe(200);
    const writtenSettings = updateSpy.mock.calls[0][0].data.settings;
    expect(writtenSettings.savedViews).toHaveLength(1);
    expect(writtenSettings.savedViews[0].label).toBe("Active drafts");
    expect(res.body.savedViews[0].id).toBe("v1");
  });

  it("PUT /settings rejects a savedView missing label", async () => {
    const client: SettingsClient = {
      shop: {
        findUnique: vi.fn(),
        update: vi.fn(),
      },
    };
    const res = await request(buildApp(client))
      .put("/settings")
      .send({
        savedViews: [{ id: "v1" }],
      });
    expect(res.status).toBe(400);
  });

  it("PUT /settings rejects > 20 savedViews", async () => {
    const tooMany = Array.from({ length: 21 }, (_, i) => ({
      id: `v${i}`,
      label: `View ${i}`,
    }));
    const client: SettingsClient = {
      shop: {
        findUnique: vi.fn(),
        update: vi.fn(),
      },
    };
    const res = await request(buildApp(client))
      .put("/settings")
      .send({ savedViews: tooMany });
    expect(res.status).toBe(400);
  });

  it("PUT /settings accepts savedView.viewMode (M-178) and rejects unknown values", async () => {
    const updateSpy = vi.fn().mockResolvedValue({
      id: "shop-uuid",
      settings: {
        savedViews: [
          { id: "v1", label: "Cards", viewMode: "card" },
        ],
      },
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
    const okRes = await request(buildApp(client))
      .put("/settings")
      .send({
        savedViews: [{ id: "v1", label: "Cards", viewMode: "card" }],
      });
    expect(okRes.status).toBe(200);

    const badRes = await request(buildApp(client))
      .put("/settings")
      .send({
        savedViews: [{ id: "v1", label: "X", viewMode: "kanban" }],
      });
    expect(badRes.status).toBe(400);
  });

  it("PUT /settings rejects savedView with unsupported status filter", async () => {
    const client: SettingsClient = {
      shop: {
        findUnique: vi.fn(),
        update: vi.fn(),
      },
    };
    const res = await request(buildApp(client))
      .put("/settings")
      .send({
        savedViews: [
          {
            id: "v1",
            label: "Bad",
            filters: { status: "deleted" },
          },
        ],
      });
    expect(res.status).toBe(400);
  });
});

describe("PUT /settings cart_default_mode metafield (M-164b)", () => {
  function clientWithUpdate(): {
    client: SettingsClient;
    update: ReturnType<typeof vi.fn>;
  } {
    const update = vi.fn().mockResolvedValue({
      id: "shop-uuid",
      settings: { cart: { defaultMode: "components_as_attributes" } },
    });
    return {
      client: {
        shop: {
          findUnique: vi.fn().mockResolvedValue({
            ...SHOP_BASE,
            settings: {},
          }),
          update,
        },
      },
      update,
    };
  }

  it("PUT with cart.defaultMode calls writeShopMetafield", async () => {
    const writeShopMetafieldImpl = vi
      .fn()
      .mockResolvedValue({ id: "gid://shopify/Metafield/1" });
    const { client } = clientWithUpdate();
    const app = buildApp(client, {
      writeShopMetafieldImpl: writeShopMetafieldImpl as unknown as SettingsDeps["writeShopMetafieldImpl"],
    });
    const res = await request(app)
      .put("/settings")
      .send({ cart: { defaultMode: "components_as_attributes" } });
    expect(res.status).toBe(200);
    expect(writeShopMetafieldImpl).toHaveBeenCalledTimes(1);
    expect(writeShopMetafieldImpl.mock.calls[0][1]).toEqual({
      namespace: "mintbundle",
      key: "cart_default_mode",
      value: "components_as_attributes",
      type: "single_line_text_field",
    });
  });

  it("PUT without cart.defaultMode does not call writeShopMetafield", async () => {
    const writeShopMetafieldImpl = vi.fn();
    const { client } = clientWithUpdate();
    const app = buildApp(client, {
      writeShopMetafieldImpl: writeShopMetafieldImpl as unknown as SettingsDeps["writeShopMetafieldImpl"],
    });
    const res = await request(app)
      .put("/settings")
      .send({ general: { brandColor: "#aabbcc" } });
    expect(res.status).toBe(200);
    expect(writeShopMetafieldImpl).not.toHaveBeenCalled();
  });

  it("metafield-write failure does not poison the settings PUT", async () => {
    const writeShopMetafieldImpl = vi
      .fn()
      .mockRejectedValue(new Error("Shopify down"));
    const { client } = clientWithUpdate();
    const app = buildApp(client, {
      writeShopMetafieldImpl: writeShopMetafieldImpl as unknown as SettingsDeps["writeShopMetafieldImpl"],
    });
    const res = await request(app)
      .put("/settings")
      .send({ cart: { defaultMode: "bundle_as_product" } });
    expect(res.status).toBe(200);
    expect(writeShopMetafieldImpl).toHaveBeenCalled();
  });

  it("missing Shopify session: skips the metafield write but still 200s", async () => {
    const writeShopMetafieldImpl = vi.fn();
    const { client } = clientWithUpdate();
    const app = buildApp(client, {
      writeShopMetafieldImpl: writeShopMetafieldImpl as unknown as SettingsDeps["writeShopMetafieldImpl"],
      withSession: false,
    });
    const res = await request(app)
      .put("/settings")
      .send({ cart: { defaultMode: "components_as_attributes" } });
    expect(res.status).toBe(200);
    expect(writeShopMetafieldImpl).not.toHaveBeenCalled();
  });

  it("round-trips an onboarding patch (M-186)", async () => {
    const ts = "2026-05-07T12:34:56.000Z";
    const updateSpy = vi.fn().mockResolvedValue({
      id: "s",
      settings: { onboarding: { blockAddedAt: ts } },
    });
    const client: SettingsClient = {
      shop: {
        findUnique: vi
          .fn()
          .mockResolvedValueOnce({ ...SHOP_BASE, settings: {} })
          .mockResolvedValueOnce({
            ...SHOP_BASE,
            settings: { onboarding: { blockAddedAt: ts } },
          }),
        update: updateSpy,
      },
    };
    const res = await request(buildApp(client))
      .put("/settings")
      .send({ onboarding: { blockAddedAt: ts } });
    expect(res.status).toBe(200);
    expect(res.body.onboarding).toMatchObject({ blockAddedAt: ts });
    expect(updateSpy).toHaveBeenCalled();
    const merged = (updateSpy.mock.calls[0][0] as { data: { settings: { onboarding: { blockAddedAt: string } } } })
      .data.settings.onboarding;
    expect(merged.blockAddedAt).toBe(ts);
  });

  it("rejects malformed onboarding datetime", async () => {
    const client: SettingsClient = {
      shop: {
        findUnique: vi.fn().mockResolvedValue({ ...SHOP_BASE, settings: {} }),
        update: vi.fn(),
      },
    };
    const res = await request(buildApp(client))
      .put("/settings")
      .send({ onboarding: { blockAddedAt: "yesterday" } });
    expect(res.status).toBe(400);
  });
});
