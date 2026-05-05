/**
 * /api/v1/settings routes (M-106).
 *
 * GET /  — current shop settings (Shop.settings JSON).
 * PUT /  — patch settings; only known keys persisted.
 */
import {
  Router,
  type Request,
  type Response,
  type NextFunction,
} from "express";
import { z } from "zod";

import { prisma } from "../config/database";
import {
  NotFoundError,
  UnauthorizedError,
} from "../middleware/errorHandler";

const PatchSchema = z.object({
  safetyLock: z.boolean().optional(),
  notifications: z
    .object({
      email: z.boolean().optional(),
      inApp: z.boolean().optional(),
    })
    .optional(),
});

export interface SettingsClient {
  shop: {
    findUnique(args: {
      where: { id: string };
      select: { settings: true };
    }): Promise<{ settings: unknown } | null>;
    update(args: {
      where: { id: string };
      data: { settings: unknown };
    }): Promise<{ id: string; settings: unknown }>;
  };
}

export interface SettingsDeps {
  client?: SettingsClient;
}

export function installSettingsRoutes(deps: SettingsDeps = {}): Router {
  const router = Router();
  const client = deps.client ?? (prisma as unknown as SettingsClient);

  function shopIdOr401(req: Request): string {
    if (!req.shopId) throw new UnauthorizedError("No shop context");
    return req.shopId;
  }

  router.get("/", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const shopId = shopIdOr401(req);
      const row = await client.shop.findUnique({
        where: { id: shopId },
        select: { settings: true },
      });
      if (!row) throw new NotFoundError("Shop");
      res.json(row.settings ?? {});
    } catch (err) {
      next(err);
    }
  });

  router.put("/", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const shopId = shopIdOr401(req);
      const patch = PatchSchema.parse(req.body ?? {});
      const existing = await client.shop.findUnique({
        where: { id: shopId },
        select: { settings: true },
      });
      if (!existing) throw new NotFoundError("Shop");
      const merged = { ...((existing.settings as object) ?? {}), ...patch };
      const updated = await client.shop.update({
        where: { id: shopId },
        data: { settings: merged },
      });
      res.json(updated.settings);
    } catch (err) {
      next(err);
    }
  });

  return router;
}

export const settingsRoutes = installSettingsRoutes();
