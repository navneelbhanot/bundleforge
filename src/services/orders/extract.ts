/**
 * Pulls bundle-bearing line items out of a Shopify order webhook
 * payload. The marker is a properties[] entry with name
 * `_mintbundle_bundle_id`.
 *
 * See docs/specs/M-076-order-processor.md.
 */
export interface ShopifyOrderLineItem {
  id?: number;
  product_id?: number;
  variant_id?: number;
  admin_graphql_api_id?: string;
  title?: string;
  quantity?: number;
  price?: string;
  properties?: Array<{ name: string; value: string }>;
}

export interface ShopifyOrderPayload {
  id?: number;
  admin_graphql_api_id?: string;
  name?: string;
  number?: number;
  currency?: string;
  customer?: { id?: number | string; admin_graphql_api_id?: string };
  line_items?: ShopifyOrderLineItem[];
}

export const BUNDLE_PROP = "_mintbundle_bundle_id";

export interface ExtractedBundleLine {
  bundleId: string;
  lineItem: ShopifyOrderLineItem;
}

export function extractBundleLineItems(
  order: ShopifyOrderPayload,
): ExtractedBundleLine[] {
  const out: ExtractedBundleLine[] = [];
  for (const li of order.line_items ?? []) {
    const prop = li.properties?.find((p) => p.name === BUNDLE_PROP);
    if (prop && prop.value) {
      out.push({ bundleId: prop.value, lineItem: li });
    }
  }
  return out;
}
