/**
 * Per-variant inventory helpers for storefront enforcement
 * (M-173d). The proxy uses these to compute whether a
 * bundle is currently paused due to low component stock.
 *
 * Single batched GraphQL call: `nodes(ids: [...])` returns
 * inventory levels for every component variant in one
 * round-trip, regardless of bundle size.
 */
import type { Session } from "@shopify/shopify-api";

import { shopifyGraphql } from "./graphql";

const VARIANT_INVENTORY_QUERY = `#graphql
  query MintBundleVariantInventory($ids: [ID!]!) {
    nodes(ids: $ids) {
      ... on ProductVariant {
        id
        inventoryQuantity
      }
    }
  }
`;

interface VariantInventoryNode {
  id?: string;
  inventoryQuantity?: number | null;
}

interface VariantInventoryResponse {
  nodes?: Array<VariantInventoryNode | null>;
}

export interface GetVariantInventoryDeps {
  shopifyGraphqlImpl?: typeof shopifyGraphql;
}

/**
 * Fetch inventoryQuantity for each variant GID. Variants
 * with `inventoryQuantity = null` (not tracked by Shopify)
 * are reported as `Infinity` so the pause check treats
 * them as never-low.
 */
export async function getVariantInventory(
  session: Session,
  variantGids: string[],
  deps: GetVariantInventoryDeps = {},
): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  if (variantGids.length === 0) return out;
  const graphql = deps.shopifyGraphqlImpl ?? shopifyGraphql;
  const data = await graphql<VariantInventoryResponse>(
    session,
    VARIANT_INVENTORY_QUERY,
    { ids: variantGids },
  );
  for (const node of data.nodes ?? []) {
    if (!node || typeof node.id !== "string") continue;
    out.set(
      node.id,
      typeof node.inventoryQuantity === "number"
        ? node.inventoryQuantity
        : Number.POSITIVE_INFINITY,
    );
  }
  return out;
}

export interface PauseInventoryRules {
  pauseWhenComponentBelow?: number | null;
}

export interface ComponentRef {
  shopifyVariantGid: string | null;
}

/**
 * Decide whether the bundle should be paused on the
 * storefront based on its component inventory levels.
 * Pure helper — no I/O.
 *
 * Returns true when the rule is configured (>0) AND any
 * component variant has fewer units than the threshold.
 *
 * Components without a `shopifyVariantGid` (a
 * misconfiguration shouldn't gate the bundle) and variants
 * missing from the inventory map are conservatively
 * treated as having `Infinity` stock — fail-open so
 * Shopify glitches don't cost merchants conversions.
 */
export function computePaused(
  rules: PauseInventoryRules | null | undefined,
  components: ComponentRef[],
  inventory: Map<string, number>,
): boolean {
  const threshold =
    rules && typeof rules.pauseWhenComponentBelow === "number"
      ? rules.pauseWhenComponentBelow
      : 0;
  if (threshold <= 0) return false;
  for (const c of components) {
    if (!c.shopifyVariantGid) continue;
    const stock = inventory.has(c.shopifyVariantGid)
      ? (inventory.get(c.shopifyVariantGid) as number)
      : Number.POSITIVE_INFINITY;
    if (stock < threshold) return true;
  }
  return false;
}
