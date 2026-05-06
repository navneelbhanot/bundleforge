/**
 * /api/v1/settings routes (M-106 + M-161).
 *
 * GET /  — current shop settings, with the `general` subobject
 *          merged from Shop columns (read-only fallbacks) + any
 *          settings.general overrides the merchant has saved.
 * PUT /  — patch settings; deep-merges the `general` subobject so
 *          partial updates from per-card Save buttons don't drop
 *          unrelated fields.
 *
 * The Shop columns (`name`, `email`, `currency`, `locale`,
 * `timezone`) reflect what Shopify gave us at install. They are the
 * defaults for the General tab. If the merchant changes
 * currency/locale/timezone in our admin, the change is stored under
 * `settings.general.<key>` — never written back to the Shop columns.
 * That keeps "what Shopify thinks" and "what the merchant overrode
 * in our app" cleanly separated.
 */
import {
  Router,
  type Request,
  type Response,
  type NextFunction,
} from "express";
import { z } from "zod";

import { prisma } from "../config/database";
import {
  NotFoundError,
  UnauthorizedError,
} from "../middleware/errorHandler";

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

const GeneralPatch = z
  .object({
    brandColor: z.string().regex(HEX_COLOR).optional(),
    logoUrl: z.string().url().optional(),
    currency: z.string().length(3).optional(),
    locale: z.string().min(2).max(5).optional(),
    timezone: z.string().min(1).optional(),
  })
  .strict();

const PatchSchema = z
  .object({
    safetyLock: z.boolean().optional(),
    notifications: z
      .object({
        email: z.boolean().optional(),
        inApp: z.boolean().optional(),
      })
      .optional(),
    general: GeneralPatch.optional(),
  })
  .strict();

interface ShopRow {
  name: string;
  email: string;
  shopifyDomain: string;
  currency: string;
  locale: string;
  timezone: string;
  settings: unknown;
}

export interface SettingsClient {
  shop: {
    findUnique(args: {
      where: { id: string };
      select: {
        name: true;
        email: true;
        shopifyDomain: true;
        currency: true;
        locale: true;
        timezone: true;
        settings: true;
      };
    }): Promise<ShopRow | null>;
    update(args: {
      where: { id: string };
      data: { settings: unknown };
    }): Promise<{ id: string; settings: unknown }>;
  };
}

export interface SettingsDeps {
  client?: SettingsClient;
}

const SHOP_SELECT = {
  name: true as const,
  email: true as const,
  shopifyDomain: true as const,
  currency: true as const,
  locale: true as const,
  timezone: true as const,
  settings: true as const,
};

interface MergedGeneral {
  name: string;
  email: string;
  shopifyDomain: string;
  brandColor: string | null;
  logoUrl: string | null;
  currency: string;
  locale: string;
  timezone: string;
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function buildGeneral(shop: ShopRow): MergedGeneral {
  const settings = isObject(shop.settings) ? shop.settings : {};
  const general = isObject(settings.general) ? settings.general : {};
  const stringOr = (v: unknown, fallback: string): string =>
    typeof v === "string" && v.length > 0 ? v : fallback;
  return {
    name: shop.name,
    email: shop.email,
    shopifyDomain: shop.shopifyDomain,
    brandColor: typeof general.brandColor === "string" ? general.brandColor : null,
    logoUrl: typeof general.logoUrl === "string" ? general.logoUrl : null,
    currency: stringOr(general.currency, shop.currency),
    locale: stringOr(general.locale, shop.locale),
    timezone: stringOr(general.timezone, shop.timezone),
  };
}

export function installSettingsRoutes(deps: SettingsDeps = {}): Router {
  const router = Router();
  const client = deps.client ?? (prisma as unknown as SettingsClient);

  function shopIdOr401(req: Request): string {
    if (!req.shopId) throw new UnauthorizedError("No shop context");
    return req.shopId;
  }

  router.get("/", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const shopId = shopIdOr401(req);
      const row = await client.shop.findUnique({
        where: { id: shopId },
        select: SHOP_SELECT,
      });
      if (!row) throw new NotFoundError("Shop");
      const settings = isObject(row.settings) ? row.settings : {};
      res.json({
        ...settings,
        general: buildGeneral(row),
      });
    } catch (err) {
      next(err);
    }
  });

  router.put("/", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const shopId = shopIdOr401(req);
      const patch = PatchSchema.parse(req.body ?? {});
      const existing = await client.shop.findUnique({
        where: { id: shopId },
        select: SHOP_SELECT,
      });
      if (!existing) throw new NotFoundError("Shop");

      const prev = isObject(existing.settings) ? existing.settings : {};
      const prevGeneral = isObject(prev.general) ? prev.general : {};

      // Deep-merge `general` so a Save on the Brand card doesn't
      // wipe a value set by the Defaults card (and vice versa).
      const nextGeneral = patch.general
        ? { ...prevGeneral, ...patch.general }
        : prevGeneral;

      const merged: Record<string, unknown> = {
        ...prev,
        ...(patch.safetyLock !== undefined && {
          safetyLock: patch.safetyLock,
        }),
        ...(patch.notifications && {
          notifications: {
            ...(isObject(prev.notifications) ? prev.notifications : {}),
            ...patch.notifications,
          },
        }),
        general: nextGeneral,
      };

      const updated = await client.shop.update({
        where: { id: shopId },
        data: { settings: merged },
      });
      const updatedSettings = isObject(updated.settings)
        ? updated.settings
        : {};
      res.json({
        ...updatedSettings,
        general: buildGeneral({
          ...existing,
          settings: updatedSettings,
        }),
      });
    } catch (err) {
      next(err);
    }
  });

  return router;
}

export const settingsRoutes = installSettingsRoutes();
