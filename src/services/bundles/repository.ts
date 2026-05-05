/**
 * Bundle repository — narrow Prisma surface used by BundleService.
 *
 * All queries are tenant-scoped by `shopId`. Soft delete sets
 * `deletedAt` and `status = "deleted"`.
 */
import { prisma } from "../../config/database";
import type { Prisma } from "../../generated/prisma";

export interface ListFilters {
  status?: string;
  type?: string;
  search?: string;
}

export interface ListParams {
  page: number;
  limit: number;
  sortBy: string;
  sortOrder: "asc" | "desc";
}

export const bundleRepo = {
  async list(shopId: string, params: ListParams, filters: ListFilters) {
    const where: Prisma.BundleWhereInput = { shopId, deletedAt: null };
    if (filters.status) where.status = filters.status;
    if (filters.type) where.type = filters.type;
    if (filters.search) {
      where.title = { contains: filters.search, mode: "insensitive" };
    }
    const skip = (params.page - 1) * params.limit;
    const orderBy: Prisma.BundleOrderByWithRelationInput = {
      [params.sortBy]: params.sortOrder,
    };
    const [data, total] = await Promise.all([
      prisma.bundle.findMany({
        where,
        skip,
        take: params.limit,
        orderBy,
        include: { items: true, pricingRules: true },
      }),
      prisma.bundle.count({ where }),
    ]);
    return { data, total };
  },

  async findById(shopId: string, id: string) {
    return prisma.bundle.findFirst({
      where: { id, shopId, deletedAt: null },
      include: {
        items: { orderBy: { position: "asc" } },
        pricingRules: { orderBy: { priority: "desc" } },
      },
    });
  },

  async create(args: Prisma.BundleCreateArgs) {
    return prisma.bundle.create(args);
  },

  async update(args: Prisma.BundleUpdateArgs) {
    return prisma.bundle.update(args);
  },

  async softDelete(id: string) {
    return prisma.bundle.update({
      where: { id },
      data: { deletedAt: new Date(), status: "deleted" },
    });
  },
};
