/**
 * Shopify Bundles → BundleForge importer (M-127).
 *
 * Input shape (Admin API products of `productType: "Bundle"`):
 *   {
 *     id, title, handle,
 *     bundleComponents: [{ componentProduct: { id }, quantity }]
 *   }
 *
 * Output: a fixed bundle with the components mapped into items.
 */
import type { CreateBundleInput } from "../../../types";
import type { MigrationResult } from "./types";

interface ShopifyBundle {
  id?: string | number;
  title?: string;
  handle?: string;
  bundleComponents?: Array<{
    componentProduct?: { id?: string; admin_graphql_api_id?: string };
    quantity?: number;
    title?: string;
  }>;
}

export function convertShopifyBundles(
  raw: unknown,
): MigrationResult {
  const errors: MigrationResult["errors"] = [];
  const bundles: CreateBundleInput[] = [];
  const list = Array.isArray(raw) ? raw : [];
  list.forEach((entry, idx) => {
    try {
      const b = entry as ShopifyBundle;
      if (!b.title) throw new Error("missing title");
      if (!Array.isArray(b.bundleComponents) || b.bundleComponents.length === 0) {
        throw new Error("missing components");
      }
      bundles.push({
        title: b.title,
        type: "fixed",
        items: b.bundleComponents.map((c) => ({
          shopifyProductGid:
            c.componentProduct?.admin_graphql_api_id ??
            (c.componentProduct?.id ? String(c.componentProduct.id) : ""),
          title: c.title ?? b.title ?? "Component",
          quantity: c.quantity ?? 1,
        })),
        pricingRules: [],
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
