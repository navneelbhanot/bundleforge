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
import { SUPPORTED_LOCALES } from "../i18n";
import {
  NotFoundError,
  UnauthorizedError,
} from "../middleware/errorHandler";
import { BUNDLE_TYPES } from "../services/bundles/validators";

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

const DisplayPatch = z
  .object({
    layout: z.enum(["grid", "list", "carousel"]).optional(),
    colorPreset: z
      .enum(["brand", "neutral", "high-contrast", "minimal"])
      .optional(),
    imagePreference: z
      .enum(["component_photos", "bundle_hero", "auto"])
      .optional(),
    addToCartCopy: z.string().min(1).max(40).optional(),
    soldOutBehavior: z.enum(["hide", "disable", "waitlist"]).optional(),
    cssOverride: z.string().max(8000).optional(),
  })
  .strict();

const InventoryPatch = z
  .object({
    lowStockThreshold: z.coerce.number().int().min(0).max(100000).optional(),
    oversellPolicy: z
      .enum(["prevent", "allow_negative", "allow_to_zero"])
      .optional(),
    auditRetentionDays: z.coerce.number().int().min(7).max(3650).optional(),
    snapshotFrequency: z
      .enum(["hourly", "every_6h", "daily", "weekly"])
      .optional(),
    lowStockAlertEnabled: z.boolean().optional(),
  })
  .strict();

const PricingPatch = z
  .object({
    roundingRule: z
      .enum(["nearest_cent", "ninety_nine", "ninety_five"])
      .optional(),
    currencyFormatterOverride: z.string().max(120).optional(),
    b2bMarkupPercent: z.coerce.number().min(-100).max(1000).optional(),
    defaultDiscountType: z
      .enum([
        "percentage",
        "flat_discount",
        "fixed",
        "tiered",
        "volume",
        "bogo",
        "custom",
      ])
      .optional(),
  })
  .strict();

const LocaleEnum = z.enum(
  SUPPORTED_LOCALES as unknown as [string, ...string[]],
);

const LocalizationPatch = z
  .object({
    enabledLocales: z.array(LocaleEnum).optional(),
    fallbackLocale: LocaleEnum.optional(),
    machineTranslateMissing: z.boolean().optional(),
  })
  .strict();

const CartPatch = z
  .object({
    defaultMode: z
      .enum(["bundle_as_product", "components_as_attributes"])
      .optional(),
    atomicCheckoutEnforcement: z
      .enum(["strict", "warn", "off"])
      .optional(),
    abandonmentBehavior: z
      .enum(["keep_selections", "clear_selections", "prompt_user"])
      .optional(),
    cartNoteTemplate: z.string().max(280).optional(),
  })
  .strict();

const NotificationChannel = z.enum(["email", "inApp", "slack", "teams"]);

const NotificationRule = z
  .object({
    enabled: z.boolean().optional(),
    channels: z.array(NotificationChannel).optional(),
  })
  .strict();

const NotificationsPatch = z
  .object({
    email: z.boolean().optional(),
    inApp: z.boolean().optional(),
    recipients: z.array(z.string().email()).max(20).optional(),
    slackWebhookUrl: z.string().url().optional().or(z.literal("")),
    teamsWebhookUrl: z.string().url().optional().or(z.literal("")),
    rules: z
      .object({
        lowStock: NotificationRule.optional(),
        publishFailure: NotificationRule.optional(),
        webhookFailure: NotificationRule.optional(),
        aiServiceDown: NotificationRule.optional(),
        unresolvedBundleOrder: NotificationRule.optional(),
      })
      .strict()
      .optional(),
  })
  .strict();

const SavedViewFilters = z
  .object({
    status: z.enum(["draft", "active", "archived"]).optional(),
    type: z
      .enum(BUNDLE_TYPES as unknown as [string, ...string[]])
      .optional(),
    search: z.string().max(200).optional(),
  })
  .strict();

const SavedViewSort = z
  .object({
    sortBy: z.enum(["createdAt", "updatedAt", "title", "priority"]),
    sortOrder: z.enum(["asc", "desc"]),
  })
  .strict();

const SavedView = z
  .object({
    id: z.string().min(1).max(100),
    label: z.string().min(1).max(40),
    filters: SavedViewFilters.optional(),
    sort: SavedViewSort.optional(),
    viewMode: z.enum(["table", "compact", "card"]).optional(),
  })
  .strict();

const SavedViewsArray = z.array(SavedView).max(20);

const PatchSchema = z
  .object({
    safetyLock: z.boolean().optional(),
    notifications: NotificationsPatch.optional(),
    general: GeneralPatch.optional(),
    display: DisplayPatch.optional(),
    inventory: InventoryPatch.optional(),
    pricing: PricingPatch.optional(),
    cart: CartPatch.optional(),
    localization: LocalizationPatch.optional(),
    savedViews: SavedViewsArray.optional(),
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

/**
 * Deep-merge a single named subobject so a Save on one card doesn't
 * drop sibling fields set by another card. Used identically for
 * `general` and `display`.
 */
function mergeSubobject<T extends Record<string, unknown>>(
  prev: unknown,
  patch: T | undefined,
): Record<string, unknown> {
  const previous = isObject(prev) ? prev : {};
  if (!patch) return previous;
  return { ...previous, ...patch };
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
        display: isObject(settings.display) ? settings.display : {},
        inventory: isObject(settings.inventory) ? settings.inventory : {},
        pricing: isObject(settings.pricing) ? settings.pricing : {},
        cart: isObject(settings.cart) ? settings.cart : {},
        localization: isObject(settings.localization)
          ? settings.localization
          : {},
        savedViews: Array.isArray(settings.savedViews)
          ? settings.savedViews
          : [],
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

      // Deep-merge each subobject so a Save on one card doesn't wipe
      // sibling fields set by another card.
      // Notifications has a nested `rules` map that itself needs
      // deep-merge — saving one rule mustn't wipe siblings. So
      // we merge two levels deep: top-level keys get
      // `mergeSubobject`, and `rules` gets its own merge.
      const prevNotifs = isObject(prev.notifications) ? prev.notifications : {};
      const patchNotifs = patch.notifications;
      const mergedNotifications = patchNotifs
        ? {
            ...prevNotifs,
            ...patchNotifs,
            rules: {
              ...(isObject(prevNotifs.rules) ? prevNotifs.rules : {}),
              ...(patchNotifs.rules ?? {}),
            },
          }
        : prevNotifs;

      const merged: Record<string, unknown> = {
        ...prev,
        ...(patch.safetyLock !== undefined && {
          safetyLock: patch.safetyLock,
        }),
        notifications: mergedNotifications,
        general: mergeSubobject(prev.general, patch.general),
        display: mergeSubobject(prev.display, patch.display),
        inventory: mergeSubobject(prev.inventory, patch.inventory),
        pricing: mergeSubobject(prev.pricing, patch.pricing),
        cart: mergeSubobject(prev.cart, patch.cart),
        localization: mergeSubobject(prev.localization, patch.localization),
        // Saved views are whole-array replace (not merged) — the
        // client owns ordering and partial CRUD would 4x the
        // surface area for no merchant benefit.
        ...(patch.savedViews !== undefined && {
          savedViews: patch.savedViews,
        }),
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
        display: isObject(updatedSettings.display)
          ? updatedSettings.display
          : {},
        inventory: isObject(updatedSettings.inventory)
          ? updatedSettings.inventory
          : {},
        pricing: isObject(updatedSettings.pricing)
          ? updatedSettings.pricing
          : {},
        cart: isObject(updatedSettings.cart) ? updatedSettings.cart : {},
        localization: isObject(updatedSettings.localization)
          ? updatedSettings.localization
          : {},
        savedViews: Array.isArray(updatedSettings.savedViews)
          ? updatedSettings.savedViews
          : [],
      });
    } catch (err) {
      next(err);
    }
  });

  return router;
}

export const settingsRoutes = installSettingsRoutes();
