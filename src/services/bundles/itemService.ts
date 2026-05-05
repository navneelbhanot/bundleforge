/**
 * BundleItem service — operations on items within a bundle.
 * Tenant safety: every op verifies parent Bundle.shopId.
 *
 * See docs/specs/M-054-bundle-item-service.md.
 */
import type { Prisma } from "../../generated/prisma";
import { prisma } from "../../config/database";
import { CreateBundleItemInput } from "../../types";
import {
  ConflictError,
  NotFoundError,
  ValidationError,
} from "../../middleware/errorHandler";

export interface BundleItemRepo {
  bundle: {
    findFirst: (args: {
      where: { id: string; shopId: string; deletedAt: null };
      select: { id: true };
    }) => Promise<{ id: string } | null>;
  };
  bundleItem: {
    create: (args: Prisma.BundleItemCreateArgs) => Promise<{ id: string }>;
    findUnique: (args: {
      where: { id: string };
      select: { id: true; bundleId: true };
    }) => Promise<{ id: string; bundleId: string } | null>;
    update: (args: Prisma.BundleItemUpdateArgs) => Promise<{ id: string }>;
    delete: (args: { where: { id: string } }) => Promise<{ id: string }>;
  };
  $transaction: <T>(
    fn: (tx: Prisma.TransactionClient) => Promise<T>,
  ) => Promise<T>;
}

export class BundleItemService {
  constructor(private repo: BundleItemRepo = prisma as unknown as BundleItemRepo) {}

  private async assertOwned(bundleId: string, shopId: string): Promise<void> {
    const b = await this.repo.bundle.findFirst({
      where: { id: bundleId, shopId, deletedAt: null },
      select: { id: true },
    });
    if (!b) throw new NotFoundError("Bundle");
  }

  private async resolveBundleIdForItem(itemId: string): Promise<string> {
    const it = await this.repo.bundleItem.findUnique({
      where: { id: itemId },
      select: { id: true, bundleId: true },
    });
    if (!it) throw new NotFoundError("BundleItem");
    return it.bundleId;
  }

  async add(
    shopId: string,
    bundleId: string,
    input: CreateBundleItemInput,
  ): Promise<{ id: string }> {
    if (!input.shopifyProductGid) {
      throw new ValidationError("shopifyProductGid is required");
    }
    await this.assertOwned(bundleId, shopId);
    return this.repo.bundleItem.create({
      data: {
        bundleId,
        shopifyProductGid: input.shopifyProductGid,
        shopifyVariantGid: input.shopifyVariantGid,
        title: input.title,
        sku: input.sku,
        quantity: input.quantity ?? 1,
        isRequired: input.isRequired ?? true,
        isDefault: input.isDefault ?? false,
        position: input.position ?? 0,
        groupName: input.groupName,
        minQuantity: input.minQuantity ?? 0,
        maxQuantity: input.maxQuantity,
        priceOverride: input.priceOverride,
      },
    });
  }

  async update(
    shopId: string,
    itemId: string,
    patch: Partial<CreateBundleItemInput>,
  ): Promise<{ id: string }> {
    const bundleId = await this.resolveBundleIdForItem(itemId);
    await this.assertOwned(bundleId, shopId);
    const data: Prisma.BundleItemUpdateInput = {};
    if (patch.title !== undefined) data.title = patch.title;
    if (patch.sku !== undefined) data.sku = patch.sku;
    if (patch.quantity !== undefined) data.quantity = patch.quantity;
    if (patch.isRequired !== undefined) data.isRequired = patch.isRequired;
    if (patch.isDefault !== undefined) data.isDefault = patch.isDefault;
    if (patch.position !== undefined) data.position = patch.position;
    if (patch.groupName !== undefined) data.groupName = patch.groupName;
    if (patch.minQuantity !== undefined) data.minQuantity = patch.minQuantity;
    if (patch.maxQuantity !== undefined) data.maxQuantity = patch.maxQuantity;
    if (patch.priceOverride !== undefined) data.priceOverride = patch.priceOverride;
    return this.repo.bundleItem.update({ where: { id: itemId }, data });
  }

  async remove(shopId: string, itemId: string): Promise<void> {
    const bundleId = await this.resolveBundleIdForItem(itemId);
    await this.assertOwned(bundleId, shopId);
    await this.repo.bundleItem.delete({ where: { id: itemId } });
  }

  async reorder(
    shopId: string,
    bundleId: string,
    orderedItemIds: string[],
  ): Promise<void> {
    if (orderedItemIds.length === 0) {
      throw new ValidationError("orderedItemIds is empty");
    }
    if (new Set(orderedItemIds).size !== orderedItemIds.length) {
      throw new ConflictError("Duplicate item ids in reorder list");
    }
    await this.assertOwned(bundleId, shopId);
    await this.repo.$transaction(async (tx) => {
      for (let i = 0; i < orderedItemIds.length; i++) {
        await tx.bundleItem.update({
          where: { id: orderedItemIds[i] },
          data: { position: i },
        });
      }
    });
  }
}
