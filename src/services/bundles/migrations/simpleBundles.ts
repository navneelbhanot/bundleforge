/**
 * Simple Bundles → BundleForge importer (M-128).
 *
 * Input shape (Simple Bundles JSON export):
 *   {
 *     name, bundleType: "fixed"|"mix_match"|"build_box"|...,
 *     components: [{productGid, qty, sku}],
 *     pricingRules: [{type, value, minQty}]
 *   }
 */
import type {
  CreateBundleInput,
  CreatePricingRuleInput,
} from "../../../types";
import type { MigrationResult } from "./types";

interface SimpleComponent {
  productGid?: string;
  qty?: number;
  sku?: string;
  title?: string;
}

interface SimpleRule {
  type?: string;
  value?: number;
  minQty?: number;
}

interface SimpleBundle {
  name?: string;
  bundleType?: string;
  components?: SimpleComponent[];
  pricingRules?: SimpleRule[];
  config?: Record<string, unknown>;
}

const TYPE_MAP: Record<string, CreateBundleInput["type"]> = {
  fixed: "fixed",
  mix_match: "mix_match",
  build_box: "build_box",
  multipack: "multipack",
  bogo: "bogo",
  bxgy: "bxgy",
  volume: "volume",
};

const RULE_MAP: Record<string, CreatePricingRuleInput["type"]> = {
  fixed: "fixed",
  percentage: "percentage",
  flat_discount: "flat_discount",
  tiered: "tiered",
  volume: "volume",
  bogo: "bogo",
};

export function convertSimpleBundles(raw: unknown): MigrationResult {
  const list = Array.isArray(raw) ? raw : [];
  const bundles: CreateBundleInput[] = [];
  const errors: MigrationResult["errors"] = [];
  list.forEach((entry, idx) => {
    try {
      const b = entry as SimpleBundle;
      if (!b.name) throw new Error("missing name");
      const type = TYPE_MAP[b.bundleType ?? ""] ?? "fixed";
      bundles.push({
        title: b.name,
        type,
        config: b.config ?? {},
        items: (b.components ?? []).map((c) => ({
          shopifyProductGid: c.productGid ?? "",
          title: c.title ?? c.sku ?? "Item",
          sku: c.sku,
          quantity: c.qty ?? 1,
        })),
        pricingRules: (b.pricingRules ?? []).map((r) => ({
          type: RULE_MAP[r.type ?? ""] ?? "fixed",
          value: r.value ?? 0,
          minQuantity: r.minQty,
        })),
      });
    } catch (e) {
      errors.push({
        index: idx,
        message: e instanceof Error ? e.message : String(e),
      });
    }
  });
  return { bundles, errors };
}
