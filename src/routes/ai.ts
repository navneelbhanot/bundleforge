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

  /**
   * GET /api/v1/ai/suggested-bundles?topN=10
   *
   * Untargeted "bundle ideas" for the merchant. Reads up to 1k recent
   * bundle_orders, counts unordered SKU pairs across the baskets, and
   * returns the top-N most-frequent pairs ranked by co-occurrence
   * count + lift.
   *
   * No AI service call required — this is pure pair counting against
   * the shop's own order history. The AI recommender at
   * /recommendations is for "given product X, what next?"; this is
   * for "what are merchants' shoppers actually buying together?".
   *
   * Returns [] (with `reason: 'no_orders'`) for fresh shops with
   * zero history so the admin UI can show a clear empty state.
   */
  router.get(
    "/suggested-bundles",
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const shopId = shopIdOr401(req);
        const topN = Math.min(20, Math.max(1, Number(req.query.topN) || 10));
        const rows = await source.bundleOrder.findMany({
          where: { shopId },
          select: { skuBreakdown: true },
          take: 1000,
        });
        const baskets = basketsFromOrders(rows);
        if (baskets.length === 0) {
          res.json({ pairs: [], totalBaskets: 0, reason: "no_orders" });
          return;
        }
        const pairCounts = new Map<string, number>();
        const productCounts = new Map<string, number>();
        for (const basket of baskets) {
          const unique = Array.from(new Set(basket)).sort();
          for (const sku of unique) {
            productCounts.set(sku, (productCounts.get(sku) ?? 0) + 1);
          }
          for (let i = 0; i < unique.length; i += 1) {
            for (let j = i + 1; j < unique.length; j += 1) {
              const key = `${unique[i]}\t${unique[j]}`;
              pairCounts.set(key, (pairCounts.get(key) ?? 0) + 1);
            }
          }
        }
        const total = baskets.length;
        const pairs = Array.from(pairCounts.entries())
          .map(([key, count]) => {
            const [a, b] = key.split("\t");
            const supportA = (productCounts.get(a) ?? 0) / total;
            const supportB = (productCounts.get(b) ?? 0) / total;
            const supportPair = count / total;
            const lift =
              supportA > 0 && supportB > 0
                ? supportPair / (supportA * supportB)
                : 0;
            return { skuA: a, skuB: b, count, support: supportPair, lift };
          })
          .sort((x, y) => y.count - x.count || y.lift - x.lift)
          .slice(0, topN);
        res.json({ pairs, totalBaskets: total });
      } catch (err) {
        next(err);
      }
    },
  );

  return router;
}

export const aiRoutes = installAiRoutes();
