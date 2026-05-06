/**
 * Build an offline Shopify Session from a Shop row (M-173d).
 *
 * Used by request paths (like the App Proxy) that don't
 * carry an authenticated Shopify session but need to make
 * Admin API calls scoped to the shop. Reads the shop's
 * encrypted access token from the database, decrypts, and
 * wraps in a Session-shaped object the Shopify SDK accepts.
 *
 * Returns null for unknown / uninstalled shops.
 */
import { Session } from "@shopify/shopify-api";

import { prisma } from "../config/database";
import { decrypt } from "../utils/encryption";

interface ShopRow {
  id: string;
  shopifyDomain: string;
  accessToken: string;
}

export interface SessionFromShopDeps {
  client?: {
    shop: {
      findUnique(args: {
        where: { shopifyDomain: string };
        select: { id: true; shopifyDomain: true; accessToken: true };
      }): Promise<ShopRow | null>;
    };
  };
  decryptFn?: (s: string) => string;
}

export async function loadOfflineSessionFromShop(
  shopDomain: string,
  deps: SessionFromShopDeps = {},
): Promise<Session | null> {
  const client =
    deps.client ?? (prisma as unknown as Required<SessionFromShopDeps>["client"]);
  const dec = deps.decryptFn ?? decrypt;

  const row = await client.shop.findUnique({
    where: { shopifyDomain: shopDomain },
    select: { id: true, shopifyDomain: true, accessToken: true },
  });
  if (!row) return null;
  const accessToken = dec(row.accessToken);
  if (!accessToken) return null;

  // Construct an offline Session. The id format mirrors
  // what the Shopify SDK uses for offline sessions:
  // `offline_<shop>`. Setting isOnline=false ensures the
  // SDK treats it as the shop-wide token.
  const session = new Session({
    id: `offline_${shopDomain}`,
    shop: shopDomain,
    state: "",
    isOnline: false,
  });
  session.accessToken = accessToken;
  return session;
}
