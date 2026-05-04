import "dotenv/config";
import express from "express";
import compression from "compression";
import helmet from "helmet";
import morgan from "morgan";
import cors from "cors";
import { shopifyApp } from "@shopify/shopify-app-express";

import { env } from "./config/env";
import { logger } from "./config/logger";
import { prisma } from "./config/database";
import { redis } from "./config/redis";
import { registerWebhooks } from "./webhooks";
import { bundleRoutes } from "./routes/bundles";
import { orderRoutes } from "./routes/orders";
import { inventoryRoutes } from "./routes/inventory";
import { analyticsRoutes } from "./routes/analytics";
import { settingsRoutes } from "./routes/settings";
import { billingRoutes } from "./routes/billing";
import { aiRoutes } from "./routes/ai";
import { errorHandler } from "./middleware/errorHandler";
import { rateLimiter } from "./middleware/rateLimiter";

async function start() {
  const app = express();

  // ── Middleware ──
  app.use(compression());
  app.use(helmet({ contentSecurityPolicy: false })); // CSP handled by Shopify
  app.use(morgan("combined", { stream: { write: (msg) => logger.info(msg.trim()) } }));
  app.use(express.json({ limit: "10mb" }));

  // ── Shopify Auth & Session ──
  // const shopify = shopifyApp({ ... });
  // app.get(shopify.config.auth.path, shopify.auth.begin());
  // app.get(shopify.config.auth.callbackPath, shopify.auth.callback(), ...);

  // ── Rate Limiting ──
  app.use("/api", rateLimiter);

  // ── API Routes ──
  app.use("/api/v1/bundles", bundleRoutes);
  app.use("/api/v1/orders", orderRoutes);
  app.use("/api/v1/inventory", inventoryRoutes);
  app.use("/api/v1/analytics", analyticsRoutes);
  app.use("/api/v1/settings", settingsRoutes);
  app.use("/api/v1/billing", billingRoutes);
  app.use("/api/v1/ai", aiRoutes);

  // ── Webhook Routes ──
  // registerWebhooks(app, shopify);

  // ── Health Check ──
  app.get("/health", async (_req, res) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      const redisOk = redis.status === "ready";
      res.json({
        status: "ok",
        version: env.APP_VERSION,
        database: "connected",
        redis: redisOk ? "connected" : "disconnected",
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      res.status(503).json({ status: "error", message: "Service unavailable" });
    }
  });

  // ── Error Handler ──
  app.use(errorHandler);

  // ── Start Server ──
  app.listen(env.PORT, () => {
    logger.info(`BundleForge server running on port ${env.PORT}`);
    logger.info(`Environment: ${env.NODE_ENV}`);
  });
}

start().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
