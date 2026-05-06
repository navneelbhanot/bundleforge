/**
 * Bundle activity log repository (M-174).
 *
 * Append-only by convention — service code never updates rows.
 * The `append` writer is wrapped in a try/catch by callers so a
 * logging hiccup never fails the underlying mutation.
 */
import { prisma } from "../../config/database";
import type { Prisma } from "../../generated/prisma";

export type BundleActivityAction =
  | "published"
  | "archived"
  | "moved_to_draft"
  | "details_updated"
  | "items_updated"
  | "pricing_updated"
  | "schedule_updated"
  | "display_updated"
  | "eligibility_updated"
  | "inventory_rules_updated"
  | "seo_updated"
  | "deleted";

export interface AppendInput {
  shopId: string;
  bundleId: string;
  action: BundleActivityAction;
  summary: string;
  metadata?: Record<string, unknown>;
}

export interface ListInput {
  page: number;
  limit: number;
}

export const bundleActivityRepo = {
  async append(input: AppendInput) {
    return prisma.bundleActivityLog.create({
      data: {
        shopId: input.shopId,
        bundleId: input.bundleId,
        action: input.action,
        summary: input.summary,
        metadata: (input.metadata ?? {}) as Prisma.InputJsonValue,
      },
    });
  },

  async list(shopId: string, bundleId: string, params: ListInput) {
    const skip = (params.page - 1) * params.limit;
    const [data, total] = await Promise.all([
      prisma.bundleActivityLog.findMany({
        where: { shopId, bundleId },
        orderBy: { createdAt: "desc" },
        skip,
        take: params.limit,
      }),
      prisma.bundleActivityLog.count({ where: { shopId, bundleId } }),
    ]);
    return { data, total };
  },
};
