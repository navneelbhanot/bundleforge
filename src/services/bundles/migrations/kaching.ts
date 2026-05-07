/**
 * Kaching Bundles → MintBundle importer (M-130).
 *
 * Kaching's JSON export shape:
 *   {
 *     name, offerType: "volume"|"bundle"|"upsell",
 *     products: [{gid, qty}],
 *     tiers: [{minQty, percent}]
 *   }
 *
 * Volume offers map to a stack of `tiered` rules (one per tier).
 * Bundle offers map to a `fixed` bundle with the listed products.
 */
import type {
  CreateBundleInput,
  CreatePricingRuleInput,
} from "../../../types";
import type { MigrationResult } from "./types";

interface KachingProduct {
  gid?: string;
  qty?: number;
}

interface KachingTier {
  minQty?: number;
  percent?: number;
}

interface KachingOffer {
  name?: string;
  offerType?: string;
  products?: KachingProduct[];
  tiers?: KachingTier[];
}

export function convertKaching(raw: unknown): MigrationResult {
  const list = Array.isArray(raw) ? raw : [];
  const bundles: CreateBundleInput[] = [];
  const errors: MigrationResult["errors"] = [];
  list.forEach((entry, idx) => {
    try {
      const o = entry as KachingOffer;
      if (!o.name) throw new Error("missing name");
      const items = (o.products ?? []).map((p) => ({
        shopifyProductGid: p.gid ?? "",
        title: p.gid ?? "Item",
        quantity: p.qty ?? 1,
      }));
      const type: CreateBundleInput["type"] =
        o.offerType === "volume" ? "volume" : "fixed";
      const pricingRules: CreatePricingRuleInput[] = [];
      if (Array.isArray(o.tiers)) {
        o.tiers.forEach((t, i) => {
          if (typeof t.percent === "number" && t.percent > 0) {
            pricingRules.push({
              type: "tiered",
              value: t.percent,
              minQuantity: t.minQty,
              priority: i + 1,
              isStackable: false,
            });
          }
        });
      }
      bundles.push({ title: o.name, type, items, pricingRules });
    } catch (e) {
      errors.push({
        index: idx,
        message: e instanceof Error ? e.message : String(e),
      });
    }
  });
  return { bundles, errors };
}
