/**
 * Bundle service — orchestrates Bundle CRUD + publish/archive (M-051..M-052).
 *
 * Repository access is in `./repository.ts`. Validators are in
 * `./validators.ts` (M-048). Pricing-rule shape conversion from API
 * input to Prisma input is centralized here.
 */
import type { Prisma } from "../../generated/prisma";
import {
  CreateBundleInput,
  CreateBundleItemInput,
  CreatePricingRuleInput,
  PaginatedResponse,
  PaginationParams,
} from "../../types";
import {
  ConflictError,
  NotFoundError,
  ValidationError,
} from "../../middleware/errorHandler";
import { bundleRepo, type ListFilters } from "./repository";
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
    await this.getById(shopId, id);
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
      data.displaySettings = input.displaySettings as Prisma.InputJsonValue;
    }
    if (input.startsAt !== undefined) {
      data.startsAt = input.startsAt ? new Date(input.startsAt) : null;
    }
    if (input.endsAt !== undefined) {
      data.endsAt = input.endsAt ? new Date(input.endsAt) : null;
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
    return bundleRepo.update({
      where: { id },
      data,
      include: { items: true, pricingRules: true },
    });
  }

  async softDelete(shopId: string, id: string): Promise<void> {
    await this.getById(shopId, id);
    await bundleRepo.softDelete(id);
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
      });
      shopifyProductGid = created.shopifyProductGid;
      shopifyProductId = created.shopifyProductId;
    }

    return bundleRepo.update({
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
  }

  /** M-052 — archive: removes from storefront without soft-deleting. */
  async archive(shopId: string, id: string): Promise<unknown> {
    await this.getById(shopId, id);
    return bundleRepo.update({
      where: { id },
      data: { status: "archived" },
      include: { items: true, pricingRules: true },
    });
  }

  /** Sentinel for ConflictError so route handlers can re-throw as 409. */
  static Conflict = ConflictError;
}
