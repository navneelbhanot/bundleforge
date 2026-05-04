/**
 * Shopify SDK singleton + factory.
 *
 * `shopify` is the production instance.
 * `buildShopify(opts)` is the factory tests use to inject session storage.
 *
 * See docs/specs/M-017-oauth-install.md.
 */
import { shopifyApp, type ShopifyApp } from "@shopify/shopify-app-express";
import { ApiVersion, LogSeverity } from "@shopify/shopify-api";
import { MemorySessionStorage } from "@shopify/shopify-app-session-storage-memory";
import type { SessionStorage } from "@shopify/shopify-app-session-storage";

import { env } from "../config/env";
import { logger } from "../config/logger";

const shopifyLogger = logger.child({ module: "shopify" });

export interface BuildShopifyOptions {
  sessionStorage?: SessionStorage;
}

export function buildShopify(opts: BuildShopifyOptions = {}): ShopifyApp {
  const hostName = new URL(env.SHOPIFY_APP_URL).host;
  return shopifyApp({
    api: {
      apiKey: env.SHOPIFY_API_KEY,
      apiSecretKey: env.SHOPIFY_API_SECRET,
      scopes: env.SHOPIFY_SCOPES.split(",").map((s) => s.trim()).filter(Boolean),
      hostName,
      apiVersion: ApiVersion.January25,
      isEmbeddedApp: true,
      logger: {
        level:
          env.LOG_LEVEL === "debug"
            ? LogSeverity.Debug
            : env.LOG_LEVEL === "warn"
              ? LogSeverity.Warning
              : env.LOG_LEVEL === "error"
                ? LogSeverity.Error
                : LogSeverity.Info,
        log: (severity, message) => {
          // Bridge Shopify logs into Pino.
          const fn =
            severity === LogSeverity.Error
              ? shopifyLogger.error
              : severity === LogSeverity.Warning
                ? shopifyLogger.warn
                : severity === LogSeverity.Debug
                  ? shopifyLogger.debug
                  : shopifyLogger.info;
          fn.call(shopifyLogger, message);
        },
      },
    },
    auth: {
      path: "/api/auth",
      callbackPath: env.SHOPIFY_AUTH_CALLBACK_PATH,
    },
    webhooks: {
      path: "/api/webhooks",
    },
    sessionStorage: opts.sessionStorage ?? new MemorySessionStorage(),
  });
}

export const shopify: ShopifyApp = buildShopify();
