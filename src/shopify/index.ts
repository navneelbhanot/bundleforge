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
import { PrismaSessionStorage } from "@shopify/shopify-app-session-storage-prisma";
import type { SessionStorage } from "@shopify/shopify-app-session-storage";

import { env } from "../config/env";
import { logger } from "../config/logger";
import { prisma } from "../config/database";

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
      // Must mirror shopify.app.toml's [access_scopes].scopes. Managed
      // Installation was supposed to let us omit these and have Shopify
      // pull them from Partner Dashboard config at OAuth time, but that
      // path broke around 2026-05-10: OAuth started redirecting with
      // `scope=` empty in the URL, Shopify granted a zero-scope access
      // token, and the SDK's webhookSubscriptions reconcile query 403'd
      // immediately, killing every install. Passing them explicitly
      // forces the legacy OAuth URL to include the scope list, which
      // works whether managed install is healthy or not.
      scopes: [
        "read_products",
        "write_products",
        "read_orders",
        "write_orders",
        "read_inventory",
        "write_inventory",
        "read_themes",
        "write_cart_transforms",
        "read_locations",
      ],
      hostName,
      apiVersion: ApiVersion.January26,
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
    sessionStorage:
      opts.sessionStorage ??
      (env.NODE_ENV === "test"
        ? new MemorySessionStorage()
        : new PrismaSessionStorage<typeof prisma>(prisma)),
  });
}

// Lazy singleton via Proxy. Building eagerly at module load was throwing
// synchronously when SHOPIFY_APP_URL was missing/malformed, which killed
// the process before any logging code ran (silent exit on Railway). With
// the proxy, the build only runs on first property access — by which
// time we've already booted enough to surface the error properly.
let _shopifyInstance: ShopifyApp | null = null;
function getShopify(): ShopifyApp {
  if (_shopifyInstance) return _shopifyInstance;
  try {
    _shopifyInstance = buildShopify();
    return _shopifyInstance;
  } catch (err) {
    // Print before re-throwing so Railway/console captures the cause
    // even if the parent handler swallows it.
    // eslint-disable-next-line no-console
    console.error("Shopify SDK init failed:", err);
    throw err;
  }
}

export const shopify: ShopifyApp = new Proxy({} as ShopifyApp, {
  get(_target, prop) {
    return Reflect.get(getShopify(), prop);
  },
}) as ShopifyApp;
