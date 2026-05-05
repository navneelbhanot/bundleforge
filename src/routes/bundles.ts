/**
 * /api/v1/bundles routes (M-053).
 *
 * Authentication is handled upstream (M-019 requireShopSession populates
 * req.shopId). Endpoints follow ARCHITECTURE.md §5.1.
 */
import { Router, type Request, type Response, type NextFunction } from "express";

import { BundleService } from "../services/bundles";
import { CreateBundleInput, PaginationParams } from "../types";
import { UnauthorizedError } from "../middleware/errorHandler";

export interface BundleRouteDeps {
  service?: BundleService;
}

export function installBundleRoutes(deps: BundleRouteDeps = {}): Router {
  const router = Router();
  const service = deps.service ?? new BundleService();

  function shopIdOr401(req: Request): string {
    if (!req.shopId) throw new UnauthorizedError("No shop context");
    return req.shopId;
  }

  router.get("/", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const shopId = shopIdOr401(req);
      const params: PaginationParams = {
        page: Number(req.query.page) || undefined,
        limit: Number(req.query.limit) || undefined,
        sortBy: typeof req.query.sortBy === "string" ? req.query.sortBy : undefined,
        sortOrder:
          req.query.sortOrder === "asc" || req.query.sortOrder === "desc"
            ? req.query.sortOrder
            : undefined,
      };
      const filters = {
        status: typeof req.query.status === "string" ? req.query.status : undefined,
        type: typeof req.query.type === "string" ? req.query.type : undefined,
        search: typeof req.query.search === "string" ? req.query.search : undefined,
      };
      res.json(await service.list(shopId, params, filters));
    } catch (err) {
      next(err);
    }
  });

  router.post("/", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const shopId = shopIdOr401(req);
      res
        .status(201)
        .json(await service.create(shopId, req.body as CreateBundleInput));
    } catch (err) {
      next(err);
    }
  });

  router.post(
    "/:id/duplicate",
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const shopId = shopIdOr401(req);
        res.status(201).json(await service.duplicate(shopId, req.params.id));
      } catch (err) {
        next(err);
      }
    },
  );

  router.post(
    "/:id/publish",
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const shopId = shopIdOr401(req);
        res.json(await service.publish(shopId, req.params.id));
      } catch (err) {
        next(err);
      }
    },
  );

  router.post(
    "/:id/archive",
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const shopId = shopIdOr401(req);
        res.json(await service.archive(shopId, req.params.id));
      } catch (err) {
        next(err);
      }
    },
  );

  router.get("/:id", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const shopId = shopIdOr401(req);
      res.json(await service.getById(shopId, req.params.id));
    } catch (err) {
      next(err);
    }
  });

  router.put("/:id", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const shopId = shopIdOr401(req);
      res.json(
        await service.update(shopId, req.params.id, req.body as Partial<CreateBundleInput>),
      );
    } catch (err) {
      next(err);
    }
  });

  router.delete(
    "/:id",
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const shopId = shopIdOr401(req);
        await service.softDelete(shopId, req.params.id);
        res.status(204).send();
      } catch (err) {
        next(err);
      }
    },
  );

  return router;
}

/** Default singleton router used by the server. */
export const bundleRoutes = installBundleRoutes();
