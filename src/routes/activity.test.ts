import express, { type Express, type NextFunction, type Request, type Response } from "express";
import { describe, it, expect, vi } from "vitest";
import request from "supertest";

import { errorHandler, requestId } from "../middleware/errorHandler";
import { installActivityRoutes } from "./activity";

declare module "express-serve-static-core" {
  interface Request {
    shopId?: string;
  }
}

function buildApp(opts: {
  rows?: Array<{
    id: string;
    bundleId: string;
    action: string;
    summary: string;
    createdAt: Date;
  }>;
  bundles?: Array<{ id: string; title: string }>;
  shopId?: string | null;
}): {
  app: Express;
  findShopWide: ReturnType<typeof vi.fn>;
  findMany: ReturnType<typeof vi.fn>;
} {
  const findShopWide = vi.fn().mockResolvedValue(opts.rows ?? []);
  const findMany = vi.fn().mockResolvedValue(opts.bundles ?? []);
  const app = express();
  app.use(requestId);
  app.use(express.json());
  app.use((req: Request, _res: Response, next: NextFunction) => {
    req.shopId = opts.shopId === null ? undefined : opts.shopId ?? "shop-1";
    next();
  });
  app.use(
    "/activity",
    installActivityRoutes({
      repo: { findShopWide } as never,
      prismaImpl: { bundle: { findMany } } as never,
    }),
  );
  app.use(errorHandler);
  return { app, findShopWide, findMany };
}

describe("/activity (M-184)", () => {
  it("returns shop-wide rows joined with bundle titles", async () => {
    const { app, findShopWide, findMany } = buildApp({
      rows: [
        {
          id: "act-1",
          bundleId: "b-1",
          action: "published",
          summary: "Published Holiday Box",
          createdAt: new Date("2026-05-07T00:00:00Z"),
        },
        {
          id: "act-2",
          bundleId: "b-2",
          action: "archived",
          summary: "Archived BOGO",
          createdAt: new Date("2026-05-06T00:00:00Z"),
        },
      ],
      bundles: [
        { id: "b-1", title: "Holiday Box" },
        { id: "b-2", title: "BOGO Weekender" },
      ],
    });

    const res = await request(app).get("/activity");
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.data[0]).toMatchObject({
      id: "act-1",
      bundleId: "b-1",
      bundleTitle: "Holiday Box",
      action: "published",
    });
    expect(findShopWide).toHaveBeenCalledWith("shop-1", { limit: 10 });
    expect(findMany).toHaveBeenCalledTimes(1);
  });

  it("caps limit at 50 even when query asks for more", async () => {
    const { app, findShopWide } = buildApp({});
    const res = await request(app).get("/activity?limit=999");
    expect(res.status).toBe(200);
    expect(findShopWide).toHaveBeenCalledWith("shop-1", { limit: 50 });
  });

  it("returns 401 when no shop context", async () => {
    const { app } = buildApp({ shopId: null });
    const res = await request(app).get("/activity");
    expect(res.status).toBe(401);
  });

  it("emits null bundleTitle when the join can't find the bundle", async () => {
    const { app } = buildApp({
      rows: [
        {
          id: "act-1",
          bundleId: "b-orphan",
          action: "deleted",
          summary: "Removed",
          createdAt: new Date(),
        },
      ],
      bundles: [],
    });
    const res = await request(app).get("/activity");
    expect(res.status).toBe(200);
    expect(res.body.data[0].bundleTitle).toBeNull();
  });

  it("skips the bundle lookup entirely when there are no rows", async () => {
    const { app, findMany } = buildApp({ rows: [], bundles: [] });
    const res = await request(app).get("/activity");
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
    expect(findMany).not.toHaveBeenCalled();
  });
});
