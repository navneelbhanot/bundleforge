/**
 * GDPR endpoints (M-146 export, M-147 delete-shop).
 *
 * Both endpoints are mounted under /api/v1/gdpr and inherit the standard
 * /api/v1 auth chain (validateAuthenticatedSession + requireShopSession),
 * so every request is implicitly scoped to req.shopId. The merchant who
 * authenticated via Shopify Admin is, by definition, the admin of the
 * shop being acted on.
 *
 * Export: returns the shop's bundles, orders, audit log, and integrations
 * (creds redacted) plus shop metadata. Mirrors what /api/customers/data_request
 * would return if we stored customer PII (we don't), generalised to the
 * full shop dataset.
 *
 * Delete: hard-deletes the Shop row; FK CASCADE removes bundles, orders,
 * audit log, integrations, etc. Reuses the existing M-030 shop/redact
 * webhook code path; the only difference is the merchant initiates it
 * via the admin instead of Shopify-as-platform.
 */
import {
  Router,
  type Request,
  type Response,
  type NextFunction,
} from "express";

import { prisma } from "../config/database";
import { logger } from "../config/logger";
import {
  NotFoundError,
  UnauthorizedError,
} from "../middleware/errorHandler";

const handlerLogger = logger.child({ module: "gdpr" });

export interface GdprClient {
  shop: {
    findUnique(args: {
      where: { id: string };
    }): Promise<Record<string, unknown> | null>;
    deleteMany(args: {
      where: { id: string };
    }): Promise<{ count: number }>;
  };
  bundle: {
    findMany(args: {
      where: { shopId: string };
    }): Promise<Array<Record<string, unknown>>>;
  };
  bundleOrder: {
    findMany(args: {
      where: { shopId: string };
    }): Promise<Array<Record<string, unknown>>>;
  };
  inventoryAuditLog: {
    findMany(args: {
      where: { shopId: string };
    }): Promise<Array<Record<string, unknown>>>;
  };
  integration: {
    findMany(args: {
      where: { shopId: string };
    }): Promise<Array<Record<string, unknown>>>;
  };
}

export interface GdprDeps {
  client?: GdprClient;
}

const SECRET_FIELDS = new Set(["accessToken", "credentials", "secret"]);

function redact<T extends Record<string, unknown>>(row: T): T {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) {
    out[k] = SECRET_FIELDS.has(k) ? "[REDACTED]" : v;
  }
  return out as T;
}

export function installGdprRoutes(deps: GdprDeps = {}): Router {
  const router = Router();
  const client = deps.client ?? (prisma as unknown as GdprClient);

  function shopIdOr401(req: Request): string {
    if (!req.shopId) throw new UnauthorizedError("No shop context");
    return req.shopId;
  }

  router.post(
    "/export",
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const shopId = shopIdOr401(req);
        const shop = await client.shop.findUnique({ where: { id: shopId } });
        if (!shop) throw new NotFoundError("Shop");

        const [bundles, orders, audit, integrations] = await Promise.all([
          client.bundle.findMany({ where: { shopId } }),
          client.bundleOrder.findMany({ where: { shopId } }),
          client.inventoryAuditLog.findMany({ where: { shopId } }),
          client.integration.findMany({ where: { shopId } }),
        ]);

        handlerLogger.info(
          {
            shopId,
            counts: {
              bundles: bundles.length,
              orders: orders.length,
              audit: audit.length,
              integrations: integrations.length,
            },
            reqId: req.id,
          },
          "GDPR export generated",
        );

        res.json({
          generatedAt: new Date().toISOString(),
          shop: redact(shop),
          bundles,
          orders,
          inventoryAuditLog: audit,
          integrations: integrations.map(redact),
        });
      } catch (err) {
        next(err);
      }
    },
  );

  router.post(
    "/delete-shop",
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const shopId = shopIdOr401(req);
        const result = await client.shop.deleteMany({ where: { id: shopId } });
        if (result.count === 0) throw new NotFoundError("Shop");
        handlerLogger.warn(
          { shopId, reqId: req.id },
          "GDPR merchant-initiated shop deletion — cascade complete",
        );
        res.json({ deleted: true, shopId });
      } catch (err) {
        next(err);
      }
    },
  );

  return router;
}

export const gdprRoutes = installGdprRoutes();
