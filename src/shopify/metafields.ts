/**
 * Tiny wrapper around Shopify's metafieldsSet mutation
 * (M-164b). Used by the settings PUT handler to push
 * shop-level admin choices into the metafield namespace
 * the Cart Transform Function reads.
 *
 * Two-call pattern: first query `{ shop { id } }` for the
 * shop's GID (Shopify doesn't expose it on the session
 * payload), then call `metafieldsSet` with that GID as the
 * `ownerId`. Both calls are stubbed via `shopifyGraphqlImpl`
 * for tests.
 */
import type { Session } from "@shopify/shopify-api";

import { shopifyGraphql } from "./graphql";

const SHOP_ID_QUERY = `#graphql
  query BundleforgeShopId {
    shop { id }
  }
`;

const METAFIELDS_SET = `#graphql
  mutation BundleforgeShopMetafieldSet($metafields: [MetafieldsSetInput!]!) {
    metafieldsSet(metafields: $metafields) {
      metafields { id namespace key value type }
      userErrors { field message }
    }
  }
`;

interface ShopIdResponse {
  shop?: { id: string };
}

interface MetafieldsSetResponse {
  metafieldsSet?: {
    metafields?: Array<{
      id: string;
      namespace: string;
      key: string;
      value: string;
      type: string;
    }>;
    userErrors?: Array<{ field?: string[]; message: string }>;
  };
}

export interface WriteShopMetafieldInput {
  namespace: string;
  key: string;
  value: string;
  type: string;
}

export interface WriteShopMetafieldDeps {
  shopifyGraphqlImpl?: typeof shopifyGraphql;
}

export async function writeShopMetafield(
  session: Session,
  input: WriteShopMetafieldInput,
  deps: WriteShopMetafieldDeps = {},
): Promise<{ id: string }> {
  const graphql = deps.shopifyGraphqlImpl ?? shopifyGraphql;
  const shopRes = await graphql<ShopIdResponse>(session, SHOP_ID_QUERY);
  const shopGid = shopRes.shop?.id;
  if (!shopGid) {
    throw new Error("Could not resolve shop GID");
  }
  const data = await graphql<MetafieldsSetResponse>(
    session,
    METAFIELDS_SET,
    {
      metafields: [
        {
          ownerId: shopGid,
          namespace: input.namespace,
          key: input.key,
          value: input.value,
          type: input.type,
        },
      ],
    },
  );
  const userErrors = data.metafieldsSet?.userErrors ?? [];
  if (userErrors.length > 0) {
    throw new Error(
      `metafieldsSet userErrors: ${userErrors.map((e) => e.message).join("; ")}`,
    );
  }
  const result = data.metafieldsSet?.metafields?.[0];
  if (!result?.id) {
    throw new Error("metafieldsSet returned no metafield");
  }
  return { id: result.id };
}
