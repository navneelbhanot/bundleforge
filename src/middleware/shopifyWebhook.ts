/**
 * Shopify webhook HMAC verifier.
 *
 * Returns two middleware: a raw body parser + a verifier. Mount as a pair
 * on `/api/webhooks`. After verification, downstream handlers can trust
 * `req.body` (parsed JSON) and the populated `req.shopify*` fields.
 *
 * See docs/specs/M-024-webhook-hmac.md.
 */
import { createHmac, timingSafeEqual } from "node:crypto";

import express, {
  type Request,
  type Response,
  type NextFunction,
  type RequestHandler,
} from "express";

import { env } from "../config/env";
import { logger } from "../config/logger";
import { UnauthorizedError } from "./errors";

const webhookLogger = logger.child({ module: "webhook-hmac" });

export interface WebhookHmacOptions {
  secret?: string;
}

export function shopifyWebhookHmac(
  opts: WebhookHmacOptions = {},
): RequestHandler[] {
  const rawParser = express.raw({ type: "application/json", limit: "5mb" });

  const verifier: RequestHandler = (
    req: Request,
    _res: Response,
    next: NextFunction,
  ): void => {
    try {
      const provided = req.header("x-shopify-hmac-sha256");
      if (!provided) {
        throw new UnauthorizedError("Missing X-Shopify-Hmac-Sha256");
      }
      const raw = req.body as Buffer;
      if (!Buffer.isBuffer(raw)) {
        throw new UnauthorizedError("Webhook body was not raw");
      }
      const secret = opts.secret ?? env.SHOPIFY_API_SECRET;
      const expected = createHmac("sha256", secret).update(raw).digest("base64");
      const a = Buffer.from(expected, "utf8");
      const b = Buffer.from(provided, "utf8");
      if (a.length !== b.length || !timingSafeEqual(a, b)) {
        webhookLogger.warn({ topic: req.header("x-shopify-topic") }, "HMAC mismatch");
        throw new UnauthorizedError("Invalid HMAC");
      }

      req.shopifyHmacValid = true;
      req.shopifyTopic = req.header("x-shopify-topic") ?? undefined;
      req.shopifyShopDomain = req.header("x-shopify-shop-domain") ?? undefined;
      req.shopifyWebhookId = req.header("x-shopify-webhook-id") ?? undefined;
      req.rawBody = raw;
      // Re-parse JSON now that HMAC is verified.
      try {
        req.body = JSON.parse(raw.toString("utf8"));
      } catch {
        req.body = {};
      }
      next();
    } catch (err) {
      next(err);
    }
  };

  return [rawParser, verifier];
}
