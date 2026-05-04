import { Router, Request, Response, NextFunction } from "express";
import { BundleService } from "../services/bundles";
import { CreateBundleInput, PaginationParams } from "../types";

export const bundleRoutes = Router();
const bundleService = new BundleService();

// GET /api/v1/bundles
bundleRoutes.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const shopId = (req as any).shopId;
    const params: PaginationParams = {
      page: Number(req.query.page) || 1,
      limit: Math.min(Number(req.query.limit) || 20, 100),
      sortBy: (req.query.sortBy as string) || "created_at",
      sortOrder: (req.query.sortOrder as "asc" | "desc") || "desc",
    };
    const result = await bundleService.list(shopId, params, {
      status: req.query.status as string,
      type: req.query.type as string,
      search: req.query.search as string,
    });
    res.json(result);
  } catch (err) { next(err); }
});

// POST /api/v1/bundles
bundleRoutes.post("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const bundle = await bundleService.create((req as any).shopId, req.body);
    res.status(201).json(bundle);
  } catch (err) { next(err); }
});

// GET /api/v1/bundles/:id
bundleRoutes.get("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const bundle = await bundleService.getById((req as any).shopId, req.params.id);
    res.json(bundle);
  } catch (err) { next(err); }
});

// PUT /api/v1/bundles/:id
bundleRoutes.put("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const bundle = await bundleService.update((req as any).shopId, req.params.id, req.body);
    res.json(bundle);
  } catch (err) { next(err); }
});

// DELETE /api/v1/bundles/:id
bundleRoutes.delete("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    await bundleService.softDelete((req as any).shopId, req.params.id);
    res.status(204).send();
  } catch (err) { next(err); }
});

// POST /api/v1/bundles/:id/duplicate
bundleRoutes.post("/:id/duplicate", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const bundle = await bundleService.duplicate((req as any).shopId, req.params.id);
    res.status(201).json(bundle);
  } catch (err) { next(err); }
});

// POST /api/v1/bundles/:id/publish
bundleRoutes.post("/:id/publish", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const bundle = await bundleService.publish((req as any).shopId, req.params.id);
    res.json(bundle);
  } catch (err) { next(err); }
});

// POST /api/v1/bundles/:id/archive
bundleRoutes.post("/:id/archive", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const bundle = await bundleService.archive((req as any).shopId, req.params.id);
    res.json(bundle);
  } catch (err) { next(err); }
});

// POST /api/v1/bundles/import
bundleRoutes.post("/import", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await bundleService.bulkImport((req as any).shopId, req.body);
    res.json(result);
  } catch (err) { next(err); }
});
