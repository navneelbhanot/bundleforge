/**
 * /api/v1/activity routes (M-184).
 *
 * Shop-wide activity feed for the dashboard's "Recent activity"
 * widget. Per-bundle activity stays at /api/v1/bundles/:id/activity.
 *
 * Returns rows from `bundle_activity_log` filtered by the caller's
 * shopId, newest-first, capped at 50. Joins each row with the
 * bundle's title so the widget can render a useful link target
 * without an extra round-trip.
 */
import {
  Router,
  type Request,
  type Response,
  type NextFunction,
} from "express";

import { prisma } from "../config/database";
import { bundleActivityRepo } from "../services/bundles/activityRepo";
import { UnauthorizedError } from "../middleware/errorHandler";

export interface ActivityDeps {
  repo?: typeof bundleActivityRepo;
  prismaImpl?: typeof prisma;
}

export function installActivityRoutes(deps: ActivityDeps = {}): Router {
  const router = Router();
  const repo = deps.repo ?? bundleActivityRepo;
  const db = deps.prismaImpl ?? prisma;

  function shopIdOr401(req: Request): string {
    if (!req.shopId) throw new UnauthorizedError("No shop context");
    return req.shopId;
  }

  router.get("/", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const shopId = shopIdOr401(req);
      const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 10));
      const rows = await repo.findShopWide(shopId, { limit });

      // Join with bundle titles in a single query so the widget
      // can render `<bundle title> — <action> — <relative time>`
      // without N+1.
      const bundleIds = Array.from(new Set(rows.map((r) => r.bundleId)));
      const bundles =
        bundleIds.length === 0
          ? []
          : await db.bundle.findMany({
              where: { id: { in: bundleIds }, shopId },
              select: { id: true, title: true },
            });
      const titleById = new Map(bundles.map((b) => [b.id, b.title]));

      res.json({
        data: rows.map((r) => ({
          id: r.id,
          bundleId: r.bundleId,
          bundleTitle: titleById.get(r.bundleId) ?? null,
          action: r.action,
          summary: r.summary,
          createdAt: r.createdAt,
        })),
      });
    } catch (err) {
      next(err);
    }
  });

  return router;
}

export const activityRoutes = installActivityRoutes();
