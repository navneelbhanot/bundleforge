import { prisma } from "../../config/database";
import { CreateBundleInput, PaginationParams, PaginatedResponse } from "../../types";
import { NotFoundError, ValidationError } from "../../middleware/errorHandler";

export class BundleService {
  async list(shopId: string, params: PaginationParams, filters: any): Promise<PaginatedResponse<any>> {
    const { page = 1, limit = 20, sortBy = "createdAt", sortOrder = "desc" } = params;
    const skip = (page - 1) * limit;
    const where: any = { shopId, deletedAt: null };
    if (filters.status) where.status = filters.status;
    if (filters.type) where.type = filters.type;
    if (filters.search) where.title = { contains: filters.search, mode: "insensitive" };

    const [data, total] = await Promise.all([
      prisma.bundle.findMany({ where, include: { items: true, pricingRules: true }, skip, take: limit, orderBy: { [sortBy]: sortOrder } }),
      prisma.bundle.count({ where }),
    ]);
    return { data, pagination: { page, limit, total, totalPages: Math.ceil(total / limit), hasNext: page * limit < total, hasPrev: page > 1 } };
  }

  async create(shopId: string, input: CreateBundleInput) {
    if (!input.title || !input.type) throw new ValidationError("Title and type are required");
    const slug = input.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

    return prisma.$transaction(async (tx) => {
      return tx.bundle.create({
        data: {
          shopId, title: input.title, slug, type: input.type, description: input.description,
          config: input.config || {}, displaySettings: input.displaySettings || {},
          startsAt: input.startsAt ? new Date(input.startsAt) : undefined,
          endsAt: input.endsAt ? new Date(input.endsAt) : undefined,
          items: { create: (input.items || []).map((item, i) => ({
            shopifyProductGid: item.shopifyProductGid, shopifyVariantGid: item.shopifyVariantGid,
            title: item.title, sku: item.sku, quantity: item.quantity || 1,
            isRequired: item.isRequired ?? true, isDefault: item.isDefault ?? false,
            position: item.position ?? i, groupName: item.groupName,
            minQuantity: item.minQuantity || 0, maxQuantity: item.maxQuantity, priceOverride: item.priceOverride,
          })) },
          pricingRules: { create: (input.pricingRules || []).map((rule) => ({
            type: rule.type, value: rule.value, minQuantity: rule.minQuantity || 1,
            maxQuantity: rule.maxQuantity, minCartValue: rule.minCartValue,
            conditions: rule.conditions || {}, priority: rule.priority || 0,
            isStackable: rule.isStackable ?? false,
            startsAt: rule.startsAt ? new Date(rule.startsAt) : undefined,
            endsAt: rule.endsAt ? new Date(rule.endsAt) : undefined,
          })) },
        },
        include: { items: true, pricingRules: true },
      });
    });
  }

  async getById(shopId: string, id: string) {
    const bundle = await prisma.bundle.findFirst({
      where: { id, shopId, deletedAt: null },
      include: { items: { orderBy: { position: "asc" } }, pricingRules: { orderBy: { priority: "desc" } } },
    });
    if (!bundle) throw new NotFoundError("Bundle");
    return bundle;
  }

  async update(shopId: string, id: string, data: Partial<CreateBundleInput>) {
    await this.getById(shopId, id);
    return prisma.bundle.update({ where: { id }, data: { title: data.title, description: data.description, config: data.config as any, displaySettings: data.displaySettings as any }, include: { items: true, pricingRules: true } });
  }

  async softDelete(shopId: string, id: string) {
    await this.getById(shopId, id);
    return prisma.bundle.update({ where: { id }, data: { deletedAt: new Date(), status: "deleted" } });
  }

  async duplicate(shopId: string, id: string) {
    const original = await this.getById(shopId, id);
    return this.create(shopId, {
      title: `${original.title} (Copy)`, type: original.type as any, description: original.description || undefined,
      items: original.items.map((item: any) => ({ shopifyProductGid: item.shopifyProductGid, shopifyVariantGid: item.shopifyVariantGid, title: item.title, sku: item.sku, quantity: item.quantity, isRequired: item.isRequired, isDefault: item.isDefault, position: item.position, groupName: item.groupName, minQuantity: item.minQuantity, maxQuantity: item.maxQuantity, priceOverride: item.priceOverride ? Number(item.priceOverride) : undefined })),
      pricingRules: original.pricingRules.map((r: any) => ({ type: r.type, value: Number(r.value), minQuantity: r.minQuantity, maxQuantity: r.maxQuantity, minCartValue: r.minCartValue ? Number(r.minCartValue) : undefined, conditions: r.conditions, priority: r.priority, isStackable: r.isStackable })),
    });
  }

  async publish(shopId: string, id: string) {
    await this.getById(shopId, id);
    // TODO: Sync to Shopify (create/update product, set metafields)
    return prisma.bundle.update({ where: { id }, data: { status: "active" }, include: { items: true, pricingRules: true } });
  }

  async archive(shopId: string, id: string) {
    await this.getById(shopId, id);
    return prisma.bundle.update({ where: { id }, data: { status: "archived" } });
  }

  async bulkImport(shopId: string, data: any) {
    // TODO: Implement CSV/migration import
    return { imported: 0, errors: [] };
  }
}
