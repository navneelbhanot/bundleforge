/**
 * /api/v1/inventory routes (M-075).
 *
 * GET   /audit    — paginated inventory_audit_log scan.
 * POST  /sync     — force manual sync (stub; full implementation lands later).
 * GET   /health   — counts of sync states by status.
 */
import {
  Router,
  type Request,
  type Response,
  type NextFunction,
} from "express";

import { prisma } from "../config/database";
import { UnauthorizedError } from "../middleware/errorHandler";

export interface AuditQuerySource {
  inventoryAuditLog: {
    findMany(args: {
      where: { shopId: string };
      orderBy: { createdAt: "desc" };
      skip: number;
      take: number;
    }): Promise<unknown[]>;
    count(args: { where: { shopId: string } }): Promise<number>;
  };
  inventorySyncState: {
    groupBy(args: {
      by: ["syncStatus"];
      where: { shopId: string };
      _count: { _all: true };
    }): Promise<Array<{ syncStatus: string; _count: { _all: number } }>>;
  };
}

export interface InventoryRouteDeps {
  source?: AuditQuerySource;
}

export function installInventoryRoutes(
  deps: InventoryRouteDeps = {},
): Router {
  const router = Router();
  const source =
    deps.source ?? (prisma as unknown as AuditQuerySource);

  function shopIdOr401(req: Request): string {
    if (!req.shopId) throw new UnauthorizedError("No shop context");
    return req.shopId;
  }

  router.get("/audit", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const shopId = shopIdOr401(req);
      const page = Math.max(1, Number(req.query.page) || 1);
      const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 50));
      const [data, total] = await Promise.all([
        source.inventoryAuditLog.findMany({
          where: { shopId },
          orderBy: { createdAt: "desc" },
          skip: (page - 1) * limit,
          take: limit,
        }),
        source.inventoryAuditLog.count({ where: { shopId } }),
      ]);
      res.json({ data, pagination: { page, limit, total } });
    } catch (err) {
      next(err);
    }
  });

  router.get(
    "/health",
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const shopId = shopIdOr401(req);
        const groups = await source.inventorySyncState.groupBy({
          by: ["syncStatus"],
          where: { shopId },
          _count: { _all: true },
        });
        const counts: Record<string, number> = {
          synced: 0,
          pending: 0,
          error: 0,
          locked: 0,
        };
        for (const g of groups) counts[g.syncStatus] = g._count._all;
        res.json({ shopId, counts });
      } catch (err) {
        next(err);
      }
    },
  );

  router.post(
    "/sync",
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const shopId = shopIdOr401(req);
        // M-080+ wires the Shopify Inventory API call. For now this just
        // acknowledges receipt — workers / scheduled jobs do the real sync.
        res.status(202).json({ shopId, queued: true });
      } catch (err) {
        next(err);
      }
    },
  );

  return router;
}

export const inventoryRoutes = installInventoryRoutes();
