/**
 * /api/v1/ai routes (M-126).
 *
 * GET /recommendations?bundleId=… — returns top-N FBT picks for the
 *   given bundle. Pulls historical baskets from `bundle_orders` for
 *   the shop, calls the AI service, and surfaces the result.
 */
import {
  Router,
  type Request,
  type Response,
  type NextFunction,
} from "express";

import { prisma } from "../config/database";
import { UnauthorizedError, ValidationError } from "../middleware/errorHandler";
import { recommend } from "../services/ai";

export interface BasketSource {
  bundleOrder: {
    findMany(args: {
      where: { shopId: string };
      select: { skuBreakdown: true };
      take: number;
    }): Promise<Array<{ skuBreakdown: unknown }>>;
  };
}

export interface AiDeps {
  source?: BasketSource;
  recommend?: typeof recommend;
}

function basketsFromOrders(rows: Array<{ skuBreakdown: unknown }>): string[][] {
  const out: string[][] = [];
  for (const row of rows) {
    const breakdown = row.skuBreakdown as Array<{ shopifyProductGid?: string; sku?: string | null }> | null;
    if (!Array.isArray(breakdown)) continue;
    const items = breakdown
      .map((b) => b.sku || b.shopifyProductGid || "")
      .filter((s) => s.length > 0);
    if (items.length >= 2) out.push(items);
  }
  return out;
}

export function installAiRoutes(deps: AiDeps = {}): Router {
  const router = Router();
  const source = deps.source ?? (prisma as unknown as BasketSource);
  const rec = deps.recommend ?? recommend;

  function shopIdOr401(req: Request): string {
    if (!req.shopId) throw new UnauthorizedError("No shop context");
    return req.shopId;
  }

  router.get(
    "/recommendations",
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const shopId = shopIdOr401(req);
        const target =
          typeof req.query.target === "string" ? req.query.target : "";
        if (!target) throw new ValidationError("target is required");
        const topN = Math.min(20, Math.max(1, Number(req.query.topN) || 5));
        const rows = await source.bundleOrder.findMany({
          where: { shopId },
          select: { skuBreakdown: true },
          take: 1000,
        });
        const baskets = basketsFromOrders(rows);
        const recommendations = await rec({ baskets, target, topN });
        res.json({ target, recommendations });
      } catch (err) {
        next(err);
      }
    },
  );

  return router;
}

export const aiRoutes = installAiRoutes();
