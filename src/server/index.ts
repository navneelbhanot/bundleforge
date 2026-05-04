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
import { rateLimiter } from "../middleware/rateLimiter";
import { shopify } from "../shopify";
import { afterAuth } from "../shopify/install";
import { aiRoutes } from "../routes/ai";
import { analyticsRoutes } from "../routes/analytics";
import { billingRoutes } from "../routes/billing";
import { inventoryRoutes } from "../routes/inventory";
import { ordersRoutes } from "../routes/orders";
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
  app.use(helmet({ contentSecurityPolicy: false })); // CSP managed by Shopify
  app.use(compression());
  app.use(express.json({ limit: "10mb" }));

  // Shopify OAuth (M-017 install, M-018 callback + persist).
  app.get(shopify.config.auth.path, shopify.auth.begin());
  app.get(
    shopify.config.auth.callbackPath,
    shopify.auth.callback(),
    afterAuth(),
    shopify.redirectToShopifyOrAppRoot(),
  );

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

  // Mount routers. Stubs return 501 until their respective milestones.
  app.use("/api/v1/orders", ordersRoutes);
  app.use("/api/v1/inventory", inventoryRoutes);
  app.use("/api/v1/analytics", analyticsRoutes);
  app.use("/api/v1/settings", settingsRoutes);
  app.use("/api/v1/billing", billingRoutes);
  app.use("/api/v1/ai", aiRoutes);
  // /api/v1/bundles deferred to M-053 (routes/bundles.ts in tsconfig exclude).

  // Catch-all 501 for /api/v1/*
  app.use("/api/v1", notImplemented);

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
  app.listen(env.PORT, () => {
    logger.info({ port: env.PORT, nodeEnv: env.NODE_ENV }, "Server listening");
  });
}

// Auto-listen when run directly, but never under tests.
if (require.main === module && env.NODE_ENV !== "test") {
  startServer().catch((err) => {
    logger.error({ err }, "Failed to start server");
    process.exit(1);
  });
}
