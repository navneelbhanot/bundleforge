/**
 * BundleOrder repository — narrow Prisma surface used by the orders
 * routes (M-102, M-103). All queries scoped by shopId.
 */
import type { Prisma } from "../../generated/prisma";
import { prisma } from "../../config/database";

export interface ListParams {
  page: number;
  limit: number;
  status?: string;
}

export const orderRepo = {
  async list(shopId: string, params: ListParams) {
    const where: Prisma.BundleOrderWhereInput = { shopId };
    if (params.status) where.status = params.status;
    const skip = (params.page - 1) * params.limit;
    const [data, total] = await Promise.all([
      prisma.bundleOrder.findMany({
        where,
        skip,
        take: params.limit,
        orderBy: { createdAt: "desc" },
      }),
      prisma.bundleOrder.count({ where }),
    ]);
    return { data, total };
  },

  async findById(shopId: string, id: string) {
    return prisma.bundleOrder.findFirst({
      where: { id, shopId },
      include: { bundle: { select: { title: true, slug: true, type: true } } },
    });
  },
};
