/**
 * Pure: convert a bundle (its items + sold quantity) into the per-SKU
 * fulfillment breakdown. Used by orders/create handler (M-078) to
 * write `BundleOrder.skuBreakdown` and forward to 3PL adapters
 * (M-117+).
 */
export interface BundleItemSnapshot {
  sku?: string | null;
  shopifyProductGid: string;
  shopifyVariantGid?: string | null;
  title?: string;
  /** Quantity per single bundle. */
  quantity: number;
}

export interface SkuBreakdownLine {
  sku: string | null;
  shopifyProductGid: string;
  shopifyVariantGid: string | null;
  title: string | null;
  quantity: number;
}

export function breakdownBundleSkus(
  items: BundleItemSnapshot[],
  bundlesSold: number,
): SkuBreakdownLine[] {
  if (bundlesSold <= 0) return [];
  return items.map((it) => ({
    sku: it.sku ?? null,
    shopifyProductGid: it.shopifyProductGid,
    shopifyVariantGid: it.shopifyVariantGid ?? null,
    title: it.title ?? null,
    quantity: it.quantity * bundlesSold,
  }));
}
