/**
 * Token-exchange auth middleware (M-214).
 *
 * Replaces shopify-app-express v7's `validateAuthenticatedSession()`
 * which uses the deprecated authorization-code OAuth flow. Shopify
 * stopped honoring the permanent offline tokens that flow produces
 * — every `shop { name }` probe was returning 403 with empty body
 * and the SDK looped back to OAuth forever (Partner Dashboard
 * banner: "Deprecated offline token use detected").
 *
 * This middleware does the modern equivalent:
 *   1. Pull the App Bridge session-token JWT off the Authorization
 *      header (or `?id_token=`).
 *   2. Decode it to learn the shop.
 *   3. Look up the existing offline session in storage.
 *   4. If absent / about-to-expire / freshly-rotated, call Shopify's
 *      token-exchange endpoint to mint a new expiring offline token.
 *   5. Persist the resulting session + upsert the Shop row.
 *   6. Attach to res.locals.shopify so downstream `requireShopSession`
 *      and the SDK's GraphQL/REST clients see it.
 *
 * Mount BEFORE `requireShopSession()` on /api/v1.
 */
import type { Request, RequestHandler } from "express";
import { Session } from "@shopify/shopify-api";

import { logger } from "../config/logger";
import { shopify } from "../shopify";
import { persistShop } from "../shopify/install";
import { UnauthorizedError } from "./errors";

const log = logger.child({ module: "token-exchange-auth" });

// shopify-api 13 does not export RequestedTokenType from its public
// index. Inline the enum value (verified in the SDK source).
const OFFLINE_ACCESS_TOKEN_TYPE =
  "urn:shopify:params:oauth:token-type:offline-access-token" as const;

/**
 * Pull the session token from `Authorization: Bearer <jwt>` or the
 * `?id_token=` fallback that App Bridge sends on top-level navigation.
 */
function extractSessionToken(req: Request): string | null {
  const auth = req.header("authorization");
  if (auth && auth.startsWith("Bearer ")) {
    return auth.slice("Bearer ".length);
  }
  const fromQuery = req.query.id_token;
  if (typeof fromQuery === "string" && fromQuery) {
    return fromQuery;
  }
  return null;
}

/**
 * Decode a session token JWT and return the shop domain (no protocol).
 * Throws if the token can't be parsed.
 */
async function shopFromSessionToken(sessionToken: string): Promise<string> {
  const payload = await shopify.api.session.decodeSessionToken(sessionToken);
  const dest = payload.dest;
  if (!dest || typeof dest !== "string") {
    throw new UnauthorizedError("Session token missing dest claim");
  }
  return dest.replace(/^https?:\/\//, "");
}

export interface TokenExchangeAuthOptions {
  /** Treat the session as "needs refresh" when expiry is within this window (ms). */
  refreshSkewMs?: number;
}

export function tokenExchangeAuth(
  opts: TokenExchangeAuthOptions = {},
): RequestHandler {
  const refreshSkewMs = opts.refreshSkewMs ?? 60_000;

  return async function tokenExchangeAuthMiddleware(req, res, next) {
    try {
      const sessionToken = extractSessionToken(req);
      if (!sessionToken) {
        throw new UnauthorizedError("Missing session token");
      }

      const shop = await shopFromSessionToken(sessionToken);

      const sessionStorage = shopify.config.sessionStorage;
      const offlineId = shopify.api.session.getOfflineId(shop);

      let session: Session | undefined =
        (await sessionStorage.loadSession(offlineId)) ?? undefined;

      const needsExchange =
        !session ||
        !session.accessToken ||
        (session.expires !== undefined &&
          session.expires.getTime() - Date.now() < refreshSkewMs);

      if (needsExchange) {
        log.debug({ shop, hadSession: Boolean(session) }, "Exchanging session token for offline access token");
        const { session: fresh } = await shopify.api.auth.tokenExchange({
          shop,
          sessionToken,
          requestedTokenType:
            OFFLINE_ACCESS_TOKEN_TYPE as unknown as Parameters<
              typeof shopify.api.auth.tokenExchange
            >[0]["requestedTokenType"],
        });
        await sessionStorage.storeSession(fresh);
        // Best-effort: upsert the Shop row so requireShopSession can find it.
        try {
          await persistShop(fresh);
        } catch (err) {
          log.warn({ shop, err }, "persistShop failed after token exchange");
        }
        session = fresh;
      }

      res.locals.shopify = {
        ...((res.locals.shopify as Record<string, unknown> | undefined) ?? {}),
        session,
      };
      next();
    } catch (err) {
      next(err);
    }
  };
}
