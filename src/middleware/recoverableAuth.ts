/**
 * Recoverable Shopify auth middleware (M-208).
 *
 * Sits AFTER `shopify.validateAuthenticatedSession()` and catches
 * the `HttpResponseError` it throws when Shopify's GraphQL API
 * rejects the session token (typically 401 or 403 — token
 * revoked, app uninstalled, or merchant un-authorized us).
 *
 * Without this wrapper, the SDK's error bubbles to the global
 * errorHandler and surfaces as HTTP 500 to the embedded admin —
 * EVERY route returns 500 until someone manually reinstalls the
 * app + clears the session table. That's exactly what happened
 * during the M-200..M-206 billing iteration: stale offline
 * tokens accumulated, the app went dark, and the merchant had
 * no on-ramp back.
 *
 * The fix is a known Shopify-recommended pattern: respond with
 * the `X-Shopify-API-Request-Failure-Reauthorize` header set to
 * `1`, plus a URL pointing at our OAuth install endpoint. App
 * Bridge running in the embedded admin sees the header, detects
 * the auth failure, and transparently redirects to the OAuth
 * approval screen. Fresh tokens get written, app loads cleanly,
 * the merchant never sees a 500.
 *
 * Reference:
 *   https://shopify.dev/docs/api/admin/getting-started#authenticating-against-the-admin-api
 *   "If the request fails with a 401 or 403, set the
 *    X-Shopify-API-Request-Failure-Reauthorize header to 1 …"
 */
import type { ErrorRequestHandler, Request, Response, NextFunction } from "express";

import { logger } from "../config/logger";

const log = logger.child({ module: "recoverable-auth" });

/**
 * Heuristically classify whether `err` came from Shopify's auth
 * gating (token-exchange failure, revoked offline session, etc.).
 * We're conservative: only the specific HttpResponseError shape
 * with a 401/403 response code triggers the recovery path. Other
 * errors fall through to the standard error handler.
 */
function isShopifyAuthFailure(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as {
    name?: string;
    constructor?: { name?: string };
    response?: { code?: number; statusText?: string };
    message?: string;
  };
  // Match either the class name or the `name` property — the
  // SDK sets both, but tests / subclasses may only set one.
  const isHttpResponseError =
    e.constructor?.name === "HttpResponseError" ||
    e.name === "HttpResponseError";
  if (!isHttpResponseError) return false;
  const code = e.response?.code;
  return code === 401 || code === 403;
}

/**
 * Pull the shop domain off the request so the reauthorize URL
 * can point at the right install path. Order of precedence:
 *  1. Query string (`?shop=...`).
 *  2. Authorization header JWT's `dest` claim (decoded without
 *     verification — we just want the shop, not trust).
 *  3. Empty string — App Bridge will prompt for shop selection.
 */
function shopFromRequest(req: Request): string {
  if (typeof req.query.shop === "string" && req.query.shop) {
    return req.query.shop;
  }
  const auth = req.header("authorization");
  if (auth && auth.startsWith("Bearer ")) {
    const token = auth.slice("Bearer ".length);
    const parts = token.split(".");
    if (parts.length === 3) {
      try {
        const payload = JSON.parse(
          Buffer.from(parts[1], "base64url").toString("utf8"),
        ) as { dest?: string };
        if (payload.dest) {
          // dest looks like https://shop.myshopify.com — strip protocol.
          return payload.dest.replace(/^https?:\/\//, "");
        }
      } catch {
        // unparseable; fall through.
      }
    }
  }
  return "";
}

/**
 * Express error-handling middleware. Mount AFTER
 * `shopify.validateAuthenticatedSession()` and BEFORE the global
 * `errorHandler`.
 */
export const recoverableAuth: ErrorRequestHandler = (
  err: unknown,
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  if (!isShopifyAuthFailure(err)) {
    next(err);
    return;
  }
  const shop = shopFromRequest(req);
  const reAuthUrl = shop ? `/api/auth?shop=${shop}` : "/api/auth";
  log.warn(
    { shop, path: req.path, method: req.method },
    "Shopify auth failed (token revoked or expired); signalling App Bridge to re-authorize",
  );
  res.setHeader("X-Shopify-API-Request-Failure-Reauthorize", "1");
  res.setHeader("X-Shopify-API-Request-Failure-Reauthorize-Url", reAuthUrl);
  res.status(401).json({
    error: {
      code: "session_expired",
      message:
        "Your Shopify session expired or was revoked. Reload the app to re-authenticate.",
      reauthorizeUrl: reAuthUrl,
    },
  });
};
