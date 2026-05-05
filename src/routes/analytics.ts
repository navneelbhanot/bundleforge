/**
 * /api/v1/analytics routes (M-109..M-115).
 */
import {
  Router,
  type Request,
  type Response,
  type NextFunction,
} from "express";
import { z } from "zod";

import {
  AnalyticsService,
  type IngestEvent,
} from "../services/analytics";
import { significance } from "../services/analytics/abTest";
import { UnauthorizedError } from "../middleware/errorHandler";

const EventSchema = z.object({
  bundleId: z.string().uuid(),
  eventType: z.enum([
    "view",
    "add_to_cart",
    "checkout_start",
    "purchase",
    "remove",
  ]),
  sessionId: z.string().optional(),
  customerId: z.string().optional(),
  revenue: z.number().nonnegative().optional(),
  currency: z.string().optional(),
  deviceType: z.string().optional(),
  sourcePage: z.string().optional(),
  abVariant: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

const IngestSchema = z.object({
  events: z.array(EventSchema).min(1).max(100),
});

const SignificanceSchema = z.object({
  a: z.object({
    conversions: z.number().int().nonnegative(),
    exposures: z.number().int().nonnegative(),
  }),
  b: z.object({
    conversions: z.number().int().nonnegative(),
    exposures: z.number().int().nonnegative(),
  }),
});

export interface AnalyticsDeps {
  service?: AnalyticsService;
}

export function installAnalyticsRoutes(
  deps: AnalyticsDeps = {},
): Router {
  const router = Router();
  const service = deps.service ?? new AnalyticsService();

  function shopIdOr401(req: Request): string {
    if (!req.shopId) throw new UnauthorizedError("No shop context");
    return req.shopId;
  }

  router.post(
    "/events",
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const shopId = shopIdOr401(req);
        const body = IngestSchema.parse(req.body);
        const result = await service.ingest(shopId, body.events as IngestEvent[]);
        res.status(202).json({ ingested: result.count });
      } catch (err) {
        next(err);
      }
    },
  );

  router.get(
    "/overview",
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const shopId = shopIdOr401(req);
        const r = await service.overview(shopId);
        res.json({
          totalRevenue: r.revenue._sum.revenue ?? 0,
          totalOrders: r.orders,
          topBundles: r.byBundle.map((b) => ({
            bundleId: b.bundleId,
            revenue: b._sum.revenue ?? 0,
            orders: b._count._all,
          })),
        });
      } catch (err) {
        next(err);
      }
    },
  );

  router.get(
    "/bundles/:id",
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const shopId = shopIdOr401(req);
        const groups = await service.byBundle(shopId, req.params.id);
        res.json({
          bundleId: req.params.id,
          groups: groups.map((g) => ({
            eventType: g.eventType,
            count: g._count._all,
            revenue: g._sum.revenue ?? 0,
          })),
        });
      } catch (err) {
        next(err);
      }
    },
  );

  router.post(
    "/ab-tests/significance",
    (req: Request, res: Response, next: NextFunction) => {
      try {
        shopIdOr401(req);
        const body = SignificanceSchema.parse(req.body);
        res.json(significance(body.a, body.b));
      } catch (err) {
        next(err);
      }
    },
  );

  return router;
}

export const analyticsRoutes = installAnalyticsRoutes();
