/**
 * Express server scaffold + /health.
 *
 * Public exports:
 *   createApp() — pure factory; tests call this.
 *   startServer() — calls createApp() and listens on env.PORT.
 *
 * Auto-listens only when this file is run directly (require.main === module)
 * AND not under NODE_ENV=test.
 *
 * See docs/specs/M-006-server-scaffold.md.
 */
// eslint-disable-next-line no-console
console.log("[boot] entrypoint reached, loading modules…");

// Teach JSON.stringify how to serialize BigInt values (Prisma returns
// these for `BigInt?` columns — e.g. Bundle.shopifyProductId — and
// Express's res.json otherwise crashes with "Do not know how to
// serialize a BigInt"). Convert to string; consumers can BigInt(...)
// it back if they need numeric ops.
(BigInt.prototype as unknown as { toJSON: () => string }).toJSON = function (
  this: bigint,
) {
  return this.toString();
};

// Surface any unhandled error before exit. Without these handlers a
// synchronous throw at module-load can exit silently on some runtimes.
process.on("uncaughtException", (err) => {
  // eslint-disable-next-line no-console
  console.error("[boot] uncaughtException:", err);
});
process.on("unhandledRejection", (err) => {
  // eslint-disable-next-line no-console
  console.error("[boot] unhandledRejection:", err);
});

import path from "node:path";
import fs from "node:fs";

import express, {
  type Express,
  type Request,
  type Response,
  type NextFunction,
} from "express";
import compression from "compression";
import helmet from "helmet";
import pinoHttp from "pino-http";

import { env } from "../config/env";
import { logger } from "../config/logger";
import { initSentry } from "../config/sentry";
import { prisma } from "../config/database";
import { redis } from "../config/redis";
import { errorHandler, requestId } from "../middleware/errorHandler";
import { recoverableAuth } from "../middleware/recoverableAuth";
import { rateLimiter, ipRateLimiter } from "../middleware/rateLimiter";
import { requireShopSession } from "../middleware/shopSession";
import { shopify } from "../shopify";
import { afterAuth } from "../shopify/install";
import { mountWebhooks } from "../webhooks";
import { appProxyAuth } from "../middleware/appProxy";
import { proxyRoutes } from "../routes/proxy";
import { storefrontRoutes } from "../routes/storefront";
import { feedRoutes } from "../routes/feeds";
import { gdprRoutes } from "../routes/gdpr";
import { aiRoutes } from "../routes/ai";
import { helpRoutes } from "../routes/help";
import { activityRoutes } from "../routes/activity";
import { settingsLogoRoutes } from "../routes/settingsLogo";
import { analyticsRoutes } from "../routes/analytics";
import { billingRoutes } from "../routes/billing";
import { bundleRoutes } from "../routes/bundles";
import { inventoryRoutes } from "../routes/inventory";
import { ordersRoutes } from "../routes/orders";
import { apiTokensRoutes } from "../routes/apiTokens";
import { integrationsRoutes } from "../routes/integrations";
import { outboundWebhooksRoutes } from "../routes/outboundWebhooks";
import { settingsRoutes } from "../routes/settings";

const HEALTH_TIMEOUT_MS = 1000;

async function withTimeout<T>(
  p: Promise<T>,
  ms: number,
  label: string,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`${label} timed out`)), ms);
    p.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      },
    );
  });
}

async function pingDb(): Promise<boolean> {
  try {
    await withTimeout(prisma.$queryRaw`SELECT 1`, HEALTH_TIMEOUT_MS, "db ping");
    return true;
  } catch {
    return false;
  }
}

async function pingRedis(): Promise<boolean> {
  try {
    await withTimeout(redis.ping(), HEALTH_TIMEOUT_MS, "redis ping");
    return true;
  } catch {
    return false;
  }
}

function notImplemented(_req: Request, res: Response): void {
  res.status(501).json({
    error: { message: "Not implemented", statusCode: 501 },
  });
}

export function createApp(): Express {
  const app = express();

  app.use(requestId);
  app.use(
    pinoHttp({
      logger: logger.child({ module: "http" }),
      // /health is high-frequency; quiet it in normal mode.
      autoLogging: { ignore: (req) => req.url === "/health" },
      genReqId: (req) => (req as Request).id,
    }),
  );
  // Disable Helmet's CSP and frameguard — embedded Shopify apps must be
  // iframable from admin.shopify.com + the merchant's myshopify.com, which
  // Helmet's default `X-Frame-Options: SAMEORIGIN` blocks. We set a
  // per-request CSP `frame-ancestors` directive below instead.
  app.use(
    helmet({
      contentSecurityPolicy: false,
      frameguard: false,
      crossOriginEmbedderPolicy: false,
      // COOP=same-origin breaks the embedded iframe ↔ admin.shopify.com
      // window.opener channel that App Bridge / Shopify's "app loaded"
      // detector relies on. Without this disabled, Shopify renders the
      // "This app can't load due to an issue with browser cookies" stub.
      crossOriginOpenerPolicy: false,
      // CORP=same-origin would also block admin.shopify.com from
      // including this document as a subresource (the iframe).
      crossOriginResourcePolicy: false,
    }),
  );
  app.use((req: Request, res: Response, next: NextFunction): void => {
    const shopParam = typeof req.query.shop === "string" ? req.query.shop : "";
    const sessionShop = (res.locals as { shopify?: { session?: { shop?: string } } } | undefined)
      ?.shopify?.session?.shop;
    const shop = shopParam || sessionShop || "";
    const ancestors = shop
      ? `https://${shop} https://admin.shopify.com`
      : "https://*.myshopify.com https://admin.shopify.com";
    res.setHeader("Content-Security-Policy", `frame-ancestors ${ancestors};`);
    next();
  });
  app.use(compression());
  app.use(express.json({ limit: "10mb" }));

  // M-148: per-IP secondary limiter on the unauthenticated surface
  // (OAuth, webhook ingest, /health). The shop-scoped limiter still runs
  // on /api below; this layer protects pre-session traffic.
  app.use(shopify.config.auth.path, ipRateLimiter);
  app.use(shopify.config.auth.callbackPath, ipRateLimiter);
  app.use("/api/webhooks", ipRateLimiter);
  app.use("/health", ipRateLimiter);

  // Shopify OAuth (M-017 install, M-018 callback + persist).
  app.get(shopify.config.auth.path, shopify.auth.begin());
  app.get(
    shopify.config.auth.callbackPath,
    shopify.auth.callback(),
    afterAuth(),
    shopify.redirectToShopifyOrAppRoot(),
  );

  // Shopify webhooks (M-024 verify + M-025 dispatch). Workers in M-026+.
  mountWebhooks(app);

  // App Proxy (M-085+). Routes are public from the storefront's
  // perspective but require Shopify's signed-query verification.
  app.use("/api/proxy", appProxyAuth(), proxyRoutes);

  // Public read-only Storefront API for headless storefronts
  // (Hydrogen, custom storefronts). CORS-open, ip-rate-limited,
  // returns published bundles only.
  app.use("/api/storefront/v1", ipRateLimiter, storefrontRoutes);

  // Public product feeds (M-122). No auth — Google ingests these.
  app.use("/api/feeds", feedRoutes);

  app.get("/health", async (_req: Request, res: Response): Promise<void> => {
    const [db, redisOk] = await Promise.all([pingDb(), pingRedis()]);
    res.json({
      status: "ok",
      version: env.APP_VERSION,
      checks: { db, redis: redisOk },
      timestamp: new Date().toISOString(),
    });
  });

  // Per-shop rate limit (M-008 will tighten + tie to shop session).
  app.use("/api", rateLimiter);

  // App Bridge token verification (M-021) + shop session loader (M-019).
  // Both run before any /api/v1 route. The SDK populates
  // res.locals.shopify.session; requireShopSession reads it and attaches
  // req.shopId/req.shopDomain for the route handlers.
  app.use("/api/v1", shopify.validateAuthenticatedSession());
  // M-208: catch HttpResponseError 401/403 from the SDK auth
  // middleware and signal App Bridge to re-authorize, instead of
  // returning a generic 500 that leaves the embedded admin in a
  // dead state until someone manually clears the session table.
  app.use("/api/v1", recoverableAuth);
  app.use("/api/v1", requireShopSession());

  // Mount routers. Stubs return 501 until their respective milestones.
  app.use("/api/v1/bundles", bundleRoutes);
  app.use("/api/v1/orders", ordersRoutes);
  app.use("/api/v1/inventory", inventoryRoutes);
  app.use("/api/v1/analytics", analyticsRoutes);
  app.use("/api/v1/settings", settingsRoutes);
  app.use("/api/v1/integrations", integrationsRoutes);
  app.use("/api/v1/api-tokens", apiTokensRoutes);
  app.use("/api/v1/outbound-webhooks", outboundWebhooksRoutes);
  app.use("/api/v1/billing", billingRoutes);
  app.use("/api/v1/ai", aiRoutes);
  app.use("/api/v1/gdpr", gdprRoutes);
  app.use("/api/v1/help", helpRoutes);
  app.use("/api/v1/activity", activityRoutes);
  app.use("/api/v1/settings", settingsLogoRoutes);

  // Catch-all 501 for /api/v1/*
  app.use("/api/v1", notImplemented);

  // Serve the admin SPA (built by `vite build -c frontend/vite.config.ts`
  // into dist/frontend). Shopify embedded apps require the admin assets
  // and the API to share an origin; otherwise App Bridge token flow breaks.
  // Gated on the built index.html existing — tests that don't pre-build
  // get the 404 catch-all; tests that do can exercise the SPA path.
  {
    const spaDir = path.resolve(process.cwd(), "dist", "frontend");
    const spaIndex = path.join(spaDir, "index.html");
    if (fs.existsSync(spaIndex)) {
      // Read the built index.html once and substitute placeholders
      // with their runtime values:
      //   - %VITE_SHOPIFY_API_KEY% — App Bridge's required meta tag.
      //     Vite would normally substitute this at build time, but the
      //     Docker build doesn't pass build-args, so the token ships
      //     literal and App Bridge fails to initialize otherwise.
      //   - %CRISP_WEBSITE_ID% — optional Crisp live-chat website id.
      //     When CRISP_WEBSITE_ID is set the SPA reads this meta tag
      //     and lazy-loads the Crisp script. When unset we substitute
      //     an empty string and the SPA skips the load entirely.
      const indexHtml = fs
        .readFileSync(spaIndex, "utf8")
        .replace(/%VITE_SHOPIFY_API_KEY%/g, env.SHOPIFY_API_KEY)
        .replace(/%CRISP_WEBSITE_ID%/g, env.CRISP_WEBSITE_ID ?? "");
      app.use(express.static(spaDir, { index: false, maxAge: "1h" }));
      app.get(/^\/(?!api\/|health$).*/, (_req: Request, res: Response): void => {
        res.type("html").send(indexHtml);
      });
    }
  }

  // 404 for anything else.
  app.use((_req: Request, res: Response, _next: NextFunction): void => {
    res.status(404).json({
      error: { message: "Not found", statusCode: 404 },
    });
  });

  app.use(errorHandler);

  return app;
}

export async function startServer(): Promise<void> {
  initSentry();
  const app = createApp();
  // Bind explicitly to 0.0.0.0 so Railway / Docker / k8s health probes
  // can reach us. Express 5 defaults vary across loopback adapters.
  app.listen(env.PORT, "0.0.0.0", () => {
    logger.info({ port: env.PORT, nodeEnv: env.NODE_ENV }, "Server listening");
  });
}

// Auto-listen unless under tests. We avoid `require.main === module` because
// it doesn't reliably evaluate true under `tsx` / ESM-shim runtimes; instead
// we rely on the entrypoint contract (this file is the start:web target).
if (env.NODE_ENV !== "test") {
  // eslint-disable-next-line no-console
  console.log("[boot] starting server…");
  startServer().catch((err) => {
    // Use console too in case Pino's transport hasn't flushed yet on exit.
    // eslint-disable-next-line no-console
    console.error("[boot] startServer failed:", err);
    logger.error({ err }, "Failed to start server");
    process.exit(1);
  });
}
