/**
 * /api/v1/orders routes (M-102, M-103).
 */
import {
  Router,
  type Request,
  type Response,
  type NextFunction,
} from "express";

import { orderRepo } from "../services/orders/repository";
import {
  NotFoundError,
  UnauthorizedError,
} from "../middleware/errorHandler";

export interface OrdersDeps {
  repo?: typeof orderRepo;
}

export function installOrdersRoutes(deps: OrdersDeps = {}): Router {
  const router = Router();
  const repo = deps.repo ?? orderRepo;

  function shopIdOr401(req: Request): string {
    if (!req.shopId) throw new UnauthorizedError("No shop context");
    return req.shopId;
  }

  router.get("/", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const shopId = shopIdOr401(req);
      const page = Math.max(1, Number(req.query.page) || 1);
      const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 25));
      const status =
        typeof req.query.status === "string" ? req.query.status : undefined;
      const { data, total } = await repo.list(shopId, { page, limit, status });
      res.json({
        data,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      });
    } catch (err) {
      next(err);
    }
  });

  router.get(
    "/:id",
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const shopId = shopIdOr401(req);
        const order = await repo.findById(shopId, req.params.id);
        if (!order) throw new NotFoundError("Order");
        res.json(order);
      } catch (err) {
        next(err);
      }
    },
  );

  return router;
}

export const ordersRoutes = installOrdersRoutes();
