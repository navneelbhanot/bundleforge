/**
 * Pure conversion from `{items, pricingRules}` (the shape returned by
 * the bundle service) into a PricingInput. Used by vertical-slice tests
 * (M-056..M-060) until the real cart→pricing wiring lands at M-082+.
 */
import type {
  PricingInput,
  PricingRule,
  PricingLineItem,
} from "../../src/services/pricing/contract";

export interface SliceBundleItem {
  id: string;
  shopifyProductGid: string;
  shopifyVariantGid?: string | null;
  quantity: number;
  /** decimal string, e.g. "12.50" */
  unitPrice: string;
}

export interface SliceBundleRule {
  id: string;
  type: PricingRule["type"];
  /** decimal string */
  value: string;
  minQuantity?: number;
  maxQuantity?: number;
  minCartValue?: string;
  priority?: number;
  stackable?: boolean;
  conditions?: PricingRule["conditions"];
}

export function buildPricingInput(args: {
  bundleId: string;
  currency: string;
  items: SliceBundleItem[];
  rules: SliceBundleRule[];
  now?: string;
}): PricingInput {
  const lineItems: PricingLineItem[] = args.items.map((it) => ({
    id: it.id,
    unitPrice: { amount: it.unitPrice, currencyCode: args.currency },
    quantity: it.quantity,
  }));
  const rules: PricingRule[] = args.rules.map((r) => ({
    id: r.id,
    type: r.type,
    value: r.value,
    minQuantity: r.minQuantity,
    maxQuantity: r.maxQuantity,
    minCartValue: r.minCartValue,
    priority: r.priority ?? 0,
    stackable: r.stackable ?? false,
    conditions: r.conditions,
  }));
  return {
    bundleId: args.bundleId,
    currencyCode: args.currency,
    lineItems,
    rules,
    context: { now: args.now ?? "2026-05-05T00:00:00Z" },
  };
}
