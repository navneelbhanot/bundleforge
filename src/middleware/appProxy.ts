/**
 * Shopify App Proxy signature verification (M-085).
 *
 * Shopify signs the query string with HMAC-SHA256 over the
 * sorted-by-name concatenation of all params except `signature`. The
 * computed digest, hex-encoded, must match `signature`.
 *
 * Reference: https://shopify.dev/docs/apps/build/online-store/display-dynamic-data
 */
import { createHmac, timingSafeEqual } from "node:crypto";

import { type Request, type Response, type NextFunction, type RequestHandler } from "express";

import { env } from "../config/env";
import { UnauthorizedError } from "./errors";

export function verifyAppProxySignature(
  query: Record<string, string | string[] | undefined>,
  secret: string,
): boolean {
  const provided = typeof query.signature === "string" ? query.signature : "";
  if (!provided) return false;
  // Build sorted "key=value" string for every other param. Arrays join with comma.
  const parts: string[] = [];
  for (const key of Object.keys(query).sort()) {
    if (key === "signature") continue;
    const v = query[key];
    if (v === undefined) continue;
    const value = Array.isArray(v) ? v.join(",") : v;
    parts.push(`${key}=${value}`);
  }
  const message = parts.join("");
  const expected = createHmac("sha256", secret).update(message).digest("hex");
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(provided, "utf8");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export interface AppProxyOptions {
  secret?: string;
}

export function appProxyAuth(opts: AppProxyOptions = {}): RequestHandler {
  return function appProxyAuthMiddleware(
    req: Request,
    _res: Response,
    next: NextFunction,
  ): void {
    const secret = opts.secret ?? env.SHOPIFY_API_SECRET;
    const ok = verifyAppProxySignature(
      req.query as Record<string, string | string[] | undefined>,
      secret,
    );
    if (!ok) {
      next(new UnauthorizedError("Invalid App Proxy signature"));
      return;
    }
    const shop = typeof req.query.shop === "string" ? req.query.shop : undefined;
    if (shop) {
      req.shopifyShopDomain = shop;
    }
    next();
  };
}
