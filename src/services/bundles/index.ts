/**
 * Bundle service — orchestrates Bundle CRUD + publish/archive (M-051..M-052).
 *
 * Repository access is in `./repository.ts`. Validators are in
 * `./validators.ts` (M-048). Pricing-rule shape conversion from API
 * input to Prisma input is centralized here.
 */
import type { Prisma } from "../../generated/prisma";
import { SUPPORTED_LOCALES } from "../../i18n";
import {
  CreateBundleInput,
  CreateBundleItemInput,
  CreatePricingRuleInput,
  type EligibilityInput,
  type InventoryRulesInput,
  PaginatedResponse,
  PaginationParams,
  type ScheduleSettingsInput,
} from "../../types";
import {
  ConflictError,
  NotFoundError,
  ValidationError,
} from "../../middleware/errorHandler";
import { bundleRepo, type ListFilters } from "./repository";
import {
  bundleActivityRepo,
  type BundleActivityAction,
} from "./activityRepo";
import { dispatchOutboundEvent } from "../outboundWebhooks/dispatcher";
import { logger } from "../../config/logger";
import { BUNDLE_TYPES, validateBundleConfig, type BundleType } from "./validators";

const ALLOWED_SORT_BY = new Set(["createdAt", "updatedAt", "title", "priority"]);

/** Lowercase, dash-separated, alphanumeric. */
export function slugify(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function mapItem(
  item: CreateBundleItemInput,
  position: number,
): Prisma.BundleItemCreateWithoutBundleInput {
  return {
    shopifyProductGid: item.shopifyProductGid,
    shopifyVariantGid: item.shopifyVariantGid,
    title: item.title,
    sku: item.sku,
    quantity: item.quantity ?? 1,
    isRequired: item.isRequired ?? true,
    isDefault: item.isDefault ?? false,
    position: item.position ?? position,
    groupName: item.groupName,
    minQuantity: item.minQuantity ?? 0,
    maxQuantity: item.maxQuantity,
    priceOverride: item.priceOverride,
  };
}

const DISPLAY_LAYOUTS = ["grid", "list", "carousel"] as const;
const DISPLAY_COLOR_PRESETS = [
  "brand",
  "neutral",
  "high-contrast",
  "minimal",
] as const;
const DISPLAY_IMAGE_PREFS = [
  "component_photos",
  "bundle_hero",
  "auto",
] as const;
const DISPLAY_SOLD_OUT = ["hide", "disable", "waitlist"] as const;

/**
 * Validate a per-bundle Display override. Same enums + lengths as
 * M-162's shop-level `DisplayPatch`. `null` is allowed for any
 * field and means "remove the override; fall back to the shop
 * default at render time."
 */
function validateDisplay(input: Record<string, unknown>): void {
  for (const [k, v] of Object.entries(input)) {
    if (v === null || v === undefined) continue;
    switch (k) {
      case "layout":
        if (!DISPLAY_LAYOUTS.includes(v as (typeof DISPLAY_LAYOUTS)[number])) {
          throw new ValidationError(
            `displaySettings.layout must be ${DISPLAY_LAYOUTS.join(" | ")}`,
          );
        }
        break;
      case "colorPreset":
        if (
          !DISPLAY_COLOR_PRESETS.includes(
            v as (typeof DISPLAY_COLOR_PRESETS)[number],
          )
        ) {
          throw new ValidationError(
            `displaySettings.colorPreset must be ${DISPLAY_COLOR_PRESETS.join(" | ")}`,
          );
        }
        break;
      case "imagePreference":
        if (
          !DISPLAY_IMAGE_PREFS.includes(
            v as (typeof DISPLAY_IMAGE_PREFS)[number],
          )
        ) {
          throw new ValidationError(
            `displaySettings.imagePreference must be ${DISPLAY_IMAGE_PREFS.join(" | ")}`,
          );
        }
        break;
      case "addToCartCopy":
        if (typeof v !== "string" || v.length === 0 || v.length > 40) {
          throw new ValidationError(
            "displaySettings.addToCartCopy must be 1..40 chars",
          );
        }
        break;
      case "soldOutBehavior":
        if (
          !DISPLAY_SOLD_OUT.includes(v as (typeof DISPLAY_SOLD_OUT)[number])
        ) {
          throw new ValidationError(
            `displaySettings.soldOutBehavior must be ${DISPLAY_SOLD_OUT.join(" | ")}`,
          );
        }
        break;
      case "cssOverride":
        if (typeof v !== "string") {
          throw new ValidationError(
            "displaySettings.cssOverride must be a string",
          );
        }
        if (v.length > 8000) {
          throw new ValidationError(
            "displaySettings.cssOverride must be <= 8000 chars",
          );
        }
        break;
      default:
        // Unknown keys are tolerated — same as M-162's permissive
        // server stance for the shop-level Display tab. Bundles
        // can carry forward-compatible custom keys without 400ing.
        break;
    }
  }
}

const ISO_COUNTRY_RE = /^[A-Z]{2}$/;
const SUPPORTED_LOCALE_SET = new Set<string>(SUPPORTED_LOCALES);

/**
 * Validate a per-bundle Eligibility patch. All fields optional.
 * `null` is allowed for any field and means "remove the
 * restriction" — handled by the deep-merge in update().
 */
function validateEligibility(input: EligibilityInput): void {
  for (const k of ["customerTagsAllow", "customerTagsDeny"] as const) {
    const v = input[k];
    if (v === undefined || v === null) continue;
    if (!Array.isArray(v)) {
      throw new ValidationError(`eligibility.${k} must be an array`);
    }
    if (v.length > 50) {
      throw new ValidationError(`eligibility.${k} must have <= 50 entries`);
    }
    for (const tag of v) {
      if (typeof tag !== "string" || tag.trim().length === 0) {
        throw new ValidationError(
          `eligibility.${k} entries must be non-empty strings`,
        );
      }
    }
  }
  if (input.segmentIds !== undefined && input.segmentIds !== null) {
    if (!Array.isArray(input.segmentIds)) {
      throw new ValidationError("eligibility.segmentIds must be an array");
    }
    if (input.segmentIds.length > 20) {
      throw new ValidationError("eligibility.segmentIds must have <= 20 entries");
    }
    for (const id of input.segmentIds) {
      if (typeof id !== "string" || id.trim().length === 0) {
        throw new ValidationError(
          "eligibility.segmentIds entries must be non-empty strings",
        );
      }
    }
  }
  if (
    input.requireLogin !== undefined &&
    input.requireLogin !== null &&
    typeof input.requireLogin !== "boolean"
  ) {
    throw new ValidationError("eligibility.requireLogin must be boolean");
  }
  if (input.markets !== undefined && input.markets !== null) {
    if (!Array.isArray(input.markets)) {
      throw new ValidationError("eligibility.markets must be an array");
    }
    if (input.markets.length > 100) {
      throw new ValidationError("eligibility.markets must have <= 100 entries");
    }
    for (const m of input.markets) {
      if (typeof m !== "string" || !ISO_COUNTRY_RE.test(m)) {
        throw new ValidationError(
          "eligibility.markets entries must be 2-letter uppercase ISO country codes",
        );
      }
    }
  }
  if (input.locales !== undefined && input.locales !== null) {
    if (!Array.isArray(input.locales)) {
      throw new ValidationError("eligibility.locales must be an array");
    }
    for (const loc of input.locales) {
      if (typeof loc !== "string" || !SUPPORTED_LOCALE_SET.has(loc)) {
        throw new ValidationError(
          `eligibility.locales entries must be one of: ${SUPPORTED_LOCALES.join(", ")}`,
        );
      }
    }
  }
}

const OVERSELL_POLICIES = [
  "prevent",
  "allow_negative",
  "allow_to_zero",
] as const;

/**
 * Validate a per-bundle InventoryRules patch. All fields optional.
 * `null` for any field means "remove the override; fall back to
 * the shop-level default at render time" — handled by the
 * deep-merge in update().
 *
 * Bounds match M-163's shop-level InventoryPatch (0..100000 for
 * thresholds, the same oversell-policy enum) so the per-bundle
 * override surface can never set a value the shop level wouldn't
 * accept.
 */
function validateInventoryRules(input: InventoryRulesInput): void {
  for (const k of [
    "lowStockThreshold",
    "pauseWhenComponentBelow",
  ] as const) {
    const v = input[k];
    if (v === undefined || v === null) continue;
    if (!Number.isInteger(v) || v < 0 || v > 100000) {
      throw new ValidationError(
        `inventoryRules.${k} must be an integer 0..100000`,
      );
    }
  }
  if (
    input.oversellPolicy !== undefined &&
    input.oversellPolicy !== null &&
    !OVERSELL_POLICIES.includes(
      input.oversellPolicy as (typeof OVERSELL_POLICIES)[number],
    )
  ) {
    throw new ValidationError(
      `inventoryRules.oversellPolicy must be ${OVERSELL_POLICIES.join(" | ")}`,
    );
  }
  for (const k of ["lowStockAlertEnabled", "componentOnlyMode"] as const) {
    const v = input[k];
    if (v !== undefined && v !== null && typeof v !== "boolean") {
      throw new ValidationError(`inventoryRules.${k} must be boolean`);
    }
  }
}

/**
 * Validate a ScheduleSettings patch in shape — Zod-style without
 * the dependency. Throws ValidationError on the first violation.
 * Accepts a partial; field absence is fine.
 */
function validateSchedule(input: ScheduleSettingsInput): void {
  if (input.timezone !== undefined && typeof input.timezone !== "string") {
    throw new ValidationError("scheduleSettings.timezone must be a string");
  }
  if (input.timezone !== undefined && input.timezone.length === 0) {
    throw new ValidationError("scheduleSettings.timezone must be non-empty");
  }
  if (input.endBehavior !== undefined) {
    if (input.endBehavior !== "archive" && input.endBehavior !== "pause") {
      throw new ValidationError(
        `scheduleSettings.endBehavior must be 'archive' or 'pause'`,
      );
    }
  }
  const r = input.recurringRule;
  if (r === null || r === undefined) return;
  if (
    r.type !== null &&
    r.type !== "daily" &&
    r.type !== "weekly" &&
    r.type !== "monthly"
  ) {
    throw new ValidationError(
      "scheduleSettings.recurringRule.type must be daily | weekly | monthly | null",
    );
  }
  if (r.daysOfWeek !== undefined) {
    if (r.type !== "weekly") {
      throw new ValidationError(
        "scheduleSettings.recurringRule.daysOfWeek requires type='weekly'",
      );
    }
    for (const d of r.daysOfWeek) {
      if (!Number.isInteger(d) || d < 0 || d > 6) {
        throw new ValidationError(
          "scheduleSettings.recurringRule.daysOfWeek must contain integers 0..6",
        );
      }
    }
  }
  if (r.dayOfMonth !== undefined) {
    if (r.type !== "monthly") {
      throw new ValidationError(
        "scheduleSettings.recurringRule.dayOfMonth requires type='monthly'",
      );
    }
    if (
      !Number.isInteger(r.dayOfMonth) ||
      r.dayOfMonth < 1 ||
      r.dayOfMonth > 31
    ) {
      throw new ValidationError(
        "scheduleSettings.recurringRule.dayOfMonth must be 1..31",
      );
    }
  }
  for (const k of ["startTime", "endTime"] as const) {
    const v = r[k];
    if (v !== undefined && !/^[0-2]\d:[0-5]\d$/.test(v)) {
      throw new ValidationError(
        `scheduleSettings.recurringRule.${k} must be HH:MM`,
      );
    }
  }
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

const SEO_TITLE_MAX = 60;
const SEO_DESCRIPTION_MAX = 320;

/**
 * Validate SEO fields. Matches Shopify storefront limits — anything
 * longer is silently truncated by the storefront anyway. Throws on
 * the first violation. Empty string is normalised to null by the
 * caller; this helper accepts either.
 */
function validateSeo(seoTitle?: string | null, seoDescription?: string | null): void {
  if (typeof seoTitle === "string" && seoTitle.length > SEO_TITLE_MAX) {
    throw new ValidationError(
      `seoTitle must be <= ${SEO_TITLE_MAX} chars`,
    );
  }
  if (
    typeof seoDescription === "string" &&
    seoDescription.length > SEO_DESCRIPTION_MAX
  ) {
    throw new ValidationError(
      `seoDescription must be <= ${SEO_DESCRIPTION_MAX} chars`,
    );
  }
}

/** Empty string → null for SEO fields. Matches storage normalisation. */
function normaliseSeo(v: string | null | undefined): string | null | undefined {
  if (v === undefined) return undefined;
  if (v === null) return null;
  return v.trim().length === 0 ? null : v;
}

/**
 * Best-effort activity log writer (M-174). Caller doesn't await
 * the result and a logging failure must never propagate to the
 * underlying mutation.
 */
async function logActivity(
  shopId: string,
  bundleId: string,
  action: BundleActivityAction,
  summary: string,
  metadata?: Record<string, unknown>,
): Promise<void> {
  try {
    await bundleActivityRepo.append({
      shopId,
      bundleId,
      action,
      summary,
      metadata,
    });
  } catch (err) {
    logger.warn(
      { module: "bundle-activity", bundleId, action, err },
      "Failed to write bundle activity log",
    );
  }
}

function mapRule(
  rule: CreatePricingRuleInput,
): Prisma.PricingRuleCreateWithoutBundleInput {
  return {
    type: rule.type,
    value: rule.value,
    minQuantity: rule.minQuantity ?? 1,
    maxQuantity: rule.maxQuantity,
    minCartValue: rule.minCartValue,
    conditions: (rule.conditions ?? {}) as Prisma.InputJsonValue,
    priority: rule.priority ?? 0,
    isStackable: rule.isStackable ?? false,
    startsAt: rule.startsAt ? new Date(rule.startsAt) : undefined,
    endsAt: rule.endsAt ? new Date(rule.endsAt) : undefined,
  };
}

export class BundleService {
  async list(
    shopId: string,
    params: PaginationParams,
    filters: ListFilters,
  ): Promise<PaginatedResponse<unknown>> {
    const page = Math.max(1, params.page ?? 1);
    const limit = Math.min(100, Math.max(1, params.limit ?? 20));
    const requestedSort = params.sortBy ?? "createdAt";
    const sortBy = ALLOWED_SORT_BY.has(requestedSort) ? requestedSort : "createdAt";
    const sortOrder: "asc" | "desc" = params.sortOrder === "asc" ? "asc" : "desc";

    const { data, total } = await bundleRepo.list(
      shopId,
      { page, limit, sortBy, sortOrder },
      filters,
    );
    return {
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNext: page * limit < total,
        hasPrev: page > 1,
      },
    };
  }

  async getById(shopId: string, id: string): Promise<unknown> {
    const bundle = await bundleRepo.findById(shopId, id);
    if (!bundle) throw new NotFoundError("Bundle");
    return bundle;
  }

  async create(shopId: string, input: CreateBundleInput): Promise<unknown> {
    if (!input.title) throw new ValidationError("title is required");
    if (!input.type) throw new ValidationError("type is required");
    if (!(BUNDLE_TYPES as readonly string[]).includes(input.type)) {
      throw new ValidationError(`Unknown bundle type: ${input.type}`);
    }
    const config = validateBundleConfig(input.type as BundleType, input.config ?? {});
    const slug = slugify(input.title);
    if (!slug) throw new ValidationError("title produces an empty slug");

    if (input.scheduleSettings) validateSchedule(input.scheduleSettings);
    if (input.displaySettings) validateDisplay(input.displaySettings);
    if (input.eligibility) validateEligibility(input.eligibility);
    if (input.inventoryRules) validateInventoryRules(input.inventoryRules);
    validateSeo(input.seoTitle, input.seoDescription);
    const seoTitle = normaliseSeo(input.seoTitle);
    const seoDescription = normaliseSeo(input.seoDescription);
    if (input.startsAt && input.endsAt) {
      if (new Date(input.endsAt).getTime() < new Date(input.startsAt).getTime()) {
        throw new ValidationError("endsAt must be on/after startsAt");
      }
    }

    return bundleRepo.create({
      data: {
        shopId,
        title: input.title,
        slug,
        type: input.type,
        description: input.description,
        config: config as Prisma.InputJsonValue,
        displaySettings:
          (input.displaySettings ?? {}) as Prisma.InputJsonValue,
        scheduleSettings:
          (input.scheduleSettings ?? {}) as unknown as Prisma.InputJsonValue,
        eligibility:
          (input.eligibility ?? {}) as unknown as Prisma.InputJsonValue,
        inventoryRules:
          (input.inventoryRules ?? {}) as unknown as Prisma.InputJsonValue,
        ...(seoTitle !== undefined && { seoTitle }),
        ...(seoDescription !== undefined && { seoDescription }),
        startsAt: input.startsAt ? new Date(input.startsAt) : undefined,
        endsAt: input.endsAt ? new Date(input.endsAt) : undefined,
        items: { create: (input.items ?? []).map((it, i) => mapItem(it, i)) },
        pricingRules: { create: (input.pricingRules ?? []).map(mapRule) },
      },
      include: { items: true, pricingRules: true },
    });
  }

  async update(
    shopId: string,
    id: string,
    input: Partial<CreateBundleInput>,
  ): Promise<unknown> {
    const existing = (await this.getById(shopId, id)) as {
      scheduleSettings?: unknown;
      displaySettings?: unknown;
      eligibility?: unknown;
      inventoryRules?: unknown;
    };
    const data: Prisma.BundleUpdateInput = {};
    if (input.title !== undefined) {
      data.title = input.title;
      data.slug = slugify(input.title);
    }
    if (input.description !== undefined) data.description = input.description;
    if (input.config !== undefined && input.type) {
      data.config = validateBundleConfig(
        input.type as BundleType,
        input.config,
      ) as Prisma.InputJsonValue;
    }
    if (input.displaySettings !== undefined) {
      validateDisplay(input.displaySettings);
      // Deep-merge so saving a single card doesn't drop sibling
      // overrides. `null` for a key is the explicit "remove this
      // override" signal — the field is deleted from the merged
      // object so the storefront falls back to the shop default.
      const prev = isObject(existing.displaySettings)
        ? existing.displaySettings
        : {};
      const merged: Record<string, unknown> = { ...prev };
      for (const [k, v] of Object.entries(input.displaySettings)) {
        if (v === undefined) continue;
        if (v === null) {
          delete merged[k];
        } else {
          merged[k] = v;
        }
      }
      data.displaySettings = merged as Prisma.InputJsonValue;
    }
    if (input.scheduleSettings !== undefined) {
      validateSchedule(input.scheduleSettings);
      // Deep-merge so saving a single card doesn't drop sibling
      // fields (timezone vs recurringRule vs endBehavior).
      const prev = isObject(existing.scheduleSettings)
        ? existing.scheduleSettings
        : {};
      const merged: Record<string, unknown> = { ...prev };
      for (const [k, v] of Object.entries(input.scheduleSettings)) {
        if (v === undefined) continue;
        merged[k] = v;
      }
      data.scheduleSettings = merged as unknown as Prisma.InputJsonValue;
    }
    if (input.eligibility !== undefined) {
      validateEligibility(input.eligibility);
      // Deep-merge with the same null-removes-restriction semantics
      // as displaySettings — set a key to `null` to lift that
      // dimension's gate.
      const prev = isObject(existing.eligibility)
        ? existing.eligibility
        : {};
      const merged: Record<string, unknown> = { ...prev };
      for (const [k, v] of Object.entries(input.eligibility)) {
        if (v === undefined) continue;
        if (v === null) {
          delete merged[k];
        } else {
          merged[k] = v;
        }
      }
      data.eligibility = merged as Prisma.InputJsonValue;
    }
    if (input.inventoryRules !== undefined) {
      validateInventoryRules(input.inventoryRules);
      // Same null-removes-override pattern as displaySettings /
      // eligibility — `null` for any key falls the bundle back
      // to the shop-level default at render time.
      const prev = isObject(existing.inventoryRules)
        ? existing.inventoryRules
        : {};
      const merged: Record<string, unknown> = { ...prev };
      for (const [k, v] of Object.entries(input.inventoryRules)) {
        if (v === undefined) continue;
        if (v === null) {
          delete merged[k];
        } else {
          merged[k] = v;
        }
      }
      data.inventoryRules = merged as Prisma.InputJsonValue;
    }
    if (input.seoTitle !== undefined || input.seoDescription !== undefined) {
      validateSeo(input.seoTitle, input.seoDescription);
      if (input.seoTitle !== undefined) {
        data.seoTitle = normaliseSeo(input.seoTitle) ?? null;
      }
      if (input.seoDescription !== undefined) {
        data.seoDescription = normaliseSeo(input.seoDescription) ?? null;
      }
    }
    if (input.startsAt !== undefined) {
      data.startsAt = input.startsAt ? new Date(input.startsAt) : null;
    }
    if (input.endsAt !== undefined) {
      data.endsAt = input.endsAt ? new Date(input.endsAt) : null;
    }
    if (input.startsAt && input.endsAt) {
      if (new Date(input.endsAt).getTime() < new Date(input.startsAt).getTime()) {
        throw new ValidationError("endsAt must be on/after startsAt");
      }
    }
    // Replace pricing rules atomically when an array is supplied.
    // Sending [] clears all rules. Omitting the field leaves the
    // existing rules untouched.
    if (input.pricingRules !== undefined) {
      data.pricingRules = {
        deleteMany: {},
        create: input.pricingRules.map(mapRule),
      };
    }
    // Same model for items: replace-all when an array is supplied.
    if (input.items !== undefined) {
      data.items = {
        deleteMany: {},
        create: input.items.map((it, i) => mapItem(it, i)),
      };
    }
    const result = await bundleRepo.update({
      where: { id },
      data,
      include: { items: true, pricingRules: true },
    });

    // Per-section activity entries. Multiple keys in one PUT
    // produce multiple rows so the timeline reads naturally.
    if (input.title !== undefined || input.description !== undefined) {
      await logActivity(shopId, id, "details_updated", "Details updated");
    }
    if (input.items !== undefined) {
      await logActivity(
        shopId,
        id,
        "items_updated",
        `Items updated (${input.items.length} item${input.items.length === 1 ? "" : "s"})`,
        { count: input.items.length },
      );
    }
    if (input.pricingRules !== undefined) {
      await logActivity(
        shopId,
        id,
        "pricing_updated",
        `Pricing rules updated (${input.pricingRules.length} rule${input.pricingRules.length === 1 ? "" : "s"})`,
        { count: input.pricingRules.length },
      );
    }
    if (input.scheduleSettings !== undefined) {
      await logActivity(shopId, id, "schedule_updated", "Schedule updated");
    }
    if (input.displaySettings !== undefined) {
      await logActivity(shopId, id, "display_updated", "Display settings updated");
    }
    if (input.eligibility !== undefined) {
      await logActivity(shopId, id, "eligibility_updated", "Customer eligibility updated");
    }
    if (input.inventoryRules !== undefined) {
      await logActivity(
        shopId,
        id,
        "inventory_rules_updated",
        "Inventory rules updated",
      );
    }
    if (input.seoTitle !== undefined || input.seoDescription !== undefined) {
      await logActivity(shopId, id, "seo_updated", "SEO metadata updated");
    }

    return result;
  }

  async softDelete(shopId: string, id: string): Promise<void> {
    await this.getById(shopId, id);
    await bundleRepo.softDelete(id);
    await logActivity(shopId, id, "deleted", "Bundle deleted");
  }

  /** M-050 — clone a bundle, copying items + pricing rules. */
  async duplicate(shopId: string, id: string): Promise<unknown> {
    const original = (await this.getById(shopId, id)) as {
      title: string;
      type: string;
      description: string | null;
      config: unknown;
      displaySettings: unknown;
      items: Array<{
        shopifyProductGid: string;
        shopifyVariantGid: string | null;
        title: string;
        sku: string | null;
        quantity: number;
        isRequired: boolean;
        isDefault: boolean;
        position: number;
        groupName: string | null;
        minQuantity: number;
        maxQuantity: number | null;
        priceOverride: { toString(): string } | null;
      }>;
      pricingRules: Array<{
        type: string;
        value: { toString(): string };
        minQuantity: number;
        maxQuantity: number | null;
        minCartValue: { toString(): string } | null;
        conditions: unknown;
        priority: number;
        isStackable: boolean;
        startsAt: Date | null;
        endsAt: Date | null;
      }>;
    };
    return this.create(shopId, {
      title: `${original.title} (Copy)`,
      type: original.type as BundleType,
      description: original.description ?? undefined,
      config: original.config as Record<string, unknown>,
      displaySettings: original.displaySettings as Record<string, unknown>,
      items: original.items.map((it) => ({
        shopifyProductGid: it.shopifyProductGid,
        shopifyVariantGid: it.shopifyVariantGid ?? undefined,
        title: it.title,
        sku: it.sku ?? undefined,
        quantity: it.quantity,
        isRequired: it.isRequired,
        isDefault: it.isDefault,
        position: it.position,
        groupName: it.groupName ?? undefined,
        minQuantity: it.minQuantity,
        maxQuantity: it.maxQuantity ?? undefined,
        priceOverride:
          it.priceOverride !== null ? Number(it.priceOverride.toString()) : undefined,
      })),
      pricingRules: original.pricingRules.map((r) => ({
        type: r.type as CreatePricingRuleInput["type"],
        value: Number(r.value.toString()),
        minQuantity: r.minQuantity,
        maxQuantity: r.maxQuantity ?? undefined,
        minCartValue:
          r.minCartValue !== null ? Number(r.minCartValue.toString()) : undefined,
        conditions: r.conditions as Record<string, unknown>,
        priority: r.priority,
        isStackable: r.isStackable,
        startsAt: r.startsAt ? r.startsAt.toISOString() : undefined,
        endsAt: r.endsAt ? r.endsAt.toISOString() : undefined,
      })),
    });
  }

  /** M-051 — publish: marks active. Real Shopify product sync lands later. */
  /**
   * Publish bundle (M-051): creates a Shopify product representing the
   * bundle (so it can be added to cart, ordered, scanned at POS, and
   * resolved by theme blocks via product handle), then flips status to
   * active.
   *
   * `onCreateProduct` is dependency-injected so the service stays
   * testable without a Shopify session. Route handler in
   * src/routes/bundles.ts wires the real Shopify Admin GraphQL call.
   * If the callback is omitted (e.g. older tests), publish behaves as
   * the legacy stub (status flip only) and logs a warning.
   *
   * If the bundle already has a shopifyProductGid (re-publish after
   * archive, or accidental duplicate publish), the create call is
   * skipped — the existing product is reused.
   */
  async publish(
    shopId: string,
    id: string,
    opts: {
      onCreateProduct?: (bundle: {
        id: string;
        title: string;
        slug: string;
        description: string | null;
        components: Array<{
          shopifyProductGid: string;
          shopifyVariantGid: string | null;
          quantity: number;
          sku: string | null;
        }>;
        pricingRules: Array<{
          type: string;
          value: string;
          minQuantity: number;
          maxQuantity: number | null;
          isStackable: boolean;
        }>;
        eligibility: Record<string, unknown>;
        inventoryRules: Record<string, unknown>;
      }) => Promise<{ shopifyProductGid: string; shopifyProductId: bigint }>;
    } = {},
  ): Promise<unknown> {
    const existing = (await this.getById(shopId, id)) as {
      id: string;
      title: string;
      slug: string;
      description: string | null;
      shopifyProductGid: string | null;
      shopifyProductId: bigint | null;
      eligibility: unknown;
      inventoryRules: unknown;
      items: Array<{
        shopifyProductGid: string;
        shopifyVariantGid: string | null;
        quantity: number;
        sku: string | null;
      }>;
      pricingRules: Array<{
        type: string;
        value: { toString(): string };
        minQuantity: number;
        maxQuantity: number | null;
        isStackable: boolean;
      }>;
    };

    // Guardrail: refuse to publish an empty bundle. Without
    // components, the cart-transform expand path has nothing to do
    // and Shopify's productCreate often fails at validation in
    // ways that surface as opaque 500s. Better to fail fast with
    // an actionable message.
    if (existing.items.length === 0) {
      throw new ValidationError(
        "Add at least one component to this bundle before publishing.",
      );
    }

    let shopifyProductGid = existing.shopifyProductGid;
    let shopifyProductId = existing.shopifyProductId;

    // Create Shopify product on first publish only.
    if (!shopifyProductGid && opts.onCreateProduct) {
      const created = await opts.onCreateProduct({
        id: existing.id,
        title: existing.title,
        slug: existing.slug,
        description: existing.description,
        components: existing.items.map((it) => ({
          shopifyProductGid: it.shopifyProductGid,
          shopifyVariantGid: it.shopifyVariantGid,
          quantity: it.quantity,
          sku: it.sku,
        })),
        pricingRules: existing.pricingRules.map((r) => ({
          type: r.type,
          value: r.value.toString(),
          minQuantity: r.minQuantity,
          maxQuantity: r.maxQuantity,
          isStackable: r.isStackable,
        })),
        eligibility: isObject(existing.eligibility)
          ? existing.eligibility
          : {},
        inventoryRules: isObject(existing.inventoryRules)
          ? existing.inventoryRules
          : {},
      });
      shopifyProductGid = created.shopifyProductGid;
      shopifyProductId = created.shopifyProductId;
    }

    const result = await bundleRepo.update({
      where: { id },
      data: {
        status: "active",
        ...(shopifyProductGid !== existing.shopifyProductGid && {
          shopifyProductGid,
        }),
        ...(shopifyProductId !== existing.shopifyProductId && {
          shopifyProductId,
        }),
      },
      include: { items: true, pricingRules: true },
    });
    await logActivity(shopId, id, "published", "Bundle published");
    await dispatchOutboundEvent({
      shopId,
      event: "bundle.published",
      payload: {
        id: existing.id,
        title: existing.title,
        slug: existing.slug,
        shopifyProductGid,
      },
    });
    return result;
  }

  /** M-052 — archive: removes from storefront without soft-deleting. */
  async archive(shopId: string, id: string): Promise<unknown> {
    const existing = (await this.getById(shopId, id)) as {
      id: string;
      title: string;
      slug: string;
    };
    const result = await bundleRepo.update({
      where: { id },
      data: { status: "archived" },
      include: { items: true, pricingRules: true },
    });
    await logActivity(shopId, id, "archived", "Bundle archived");
    await dispatchOutboundEvent({
      shopId,
      event: "bundle.archived",
      payload: {
        id: existing.id,
        title: existing.title,
        slug: existing.slug,
      },
    });
    return result;
  }

  /** Sentinel for ConflictError so route handlers can re-throw as 409. */
  static Conflict = ConflictError;
}
