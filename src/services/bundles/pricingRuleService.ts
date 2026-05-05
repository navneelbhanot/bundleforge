/**
 * PricingRule service — operations on a bundle's pricing rules.
 * See docs/specs/M-055-pricing-rule-service.md.
 */
import type { Prisma } from "../../generated/prisma";
import { prisma } from "../../config/database";
import { CreatePricingRuleInput } from "../../types";
import {
  NotFoundError,
  ValidationError,
} from "../../middleware/errorHandler";

export interface PricingRuleRepo {
  bundle: {
    findFirst: (args: {
      where: { id: string; shopId: string; deletedAt: null };
      select: { id: true };
    }) => Promise<{ id: string } | null>;
  };
  pricingRule: {
    create: (args: Prisma.PricingRuleCreateArgs) => Promise<{ id: string }>;
    findUnique: (args: {
      where: { id: string };
      select: { id: true; bundleId: true };
    }) => Promise<{ id: string; bundleId: string } | null>;
    update: (args: Prisma.PricingRuleUpdateArgs) => Promise<{ id: string }>;
    delete: (args: { where: { id: string } }) => Promise<{ id: string }>;
  };
}

const RULE_TYPES = [
  "fixed",
  "percentage",
  "flat_discount",
  "tiered",
  "volume",
  "bogo",
  "custom",
] as const;

export class PricingRuleService {
  constructor(
    private repo: PricingRuleRepo = prisma as unknown as PricingRuleRepo,
  ) {}

  private async assertOwned(bundleId: string, shopId: string): Promise<void> {
    const b = await this.repo.bundle.findFirst({
      where: { id: bundleId, shopId, deletedAt: null },
      select: { id: true },
    });
    if (!b) throw new NotFoundError("Bundle");
  }

  private async resolveBundleIdForRule(ruleId: string): Promise<string> {
    const r = await this.repo.pricingRule.findUnique({
      where: { id: ruleId },
      select: { id: true, bundleId: true },
    });
    if (!r) throw new NotFoundError("PricingRule");
    return r.bundleId;
  }

  async add(
    shopId: string,
    bundleId: string,
    input: CreatePricingRuleInput,
  ): Promise<{ id: string }> {
    if (!(RULE_TYPES as readonly string[]).includes(input.type)) {
      throw new ValidationError(`Unknown rule type: ${input.type}`);
    }
    if (typeof input.value !== "number" && typeof input.value !== "string") {
      throw new ValidationError("value is required");
    }
    await this.assertOwned(bundleId, shopId);
    return this.repo.pricingRule.create({
      data: {
        bundleId,
        type: input.type,
        value: input.value,
        minQuantity: input.minQuantity ?? 1,
        maxQuantity: input.maxQuantity,
        minCartValue: input.minCartValue,
        conditions: (input.conditions ?? {}) as Prisma.InputJsonValue,
        priority: input.priority ?? 0,
        isStackable: input.isStackable ?? false,
        startsAt: input.startsAt ? new Date(input.startsAt) : undefined,
        endsAt: input.endsAt ? new Date(input.endsAt) : undefined,
      },
    });
  }

  async update(
    shopId: string,
    ruleId: string,
    patch: Partial<CreatePricingRuleInput>,
  ): Promise<{ id: string }> {
    const bundleId = await this.resolveBundleIdForRule(ruleId);
    await this.assertOwned(bundleId, shopId);
    const data: Prisma.PricingRuleUpdateInput = {};
    if (patch.value !== undefined) data.value = patch.value;
    if (patch.minQuantity !== undefined) data.minQuantity = patch.minQuantity;
    if (patch.maxQuantity !== undefined) data.maxQuantity = patch.maxQuantity;
    if (patch.minCartValue !== undefined) data.minCartValue = patch.minCartValue;
    if (patch.priority !== undefined) data.priority = patch.priority;
    if (patch.isStackable !== undefined) data.isStackable = patch.isStackable;
    if (patch.conditions !== undefined) {
      data.conditions = patch.conditions as Prisma.InputJsonValue;
    }
    if (patch.startsAt !== undefined) {
      data.startsAt = patch.startsAt ? new Date(patch.startsAt) : null;
    }
    if (patch.endsAt !== undefined) {
      data.endsAt = patch.endsAt ? new Date(patch.endsAt) : null;
    }
    return this.repo.pricingRule.update({ where: { id: ruleId }, data });
  }

  async remove(shopId: string, ruleId: string): Promise<void> {
    const bundleId = await this.resolveBundleIdForRule(ruleId);
    await this.assertOwned(bundleId, shopId);
    await this.repo.pricingRule.delete({ where: { id: ruleId } });
  }
}
