import express, { type Express } from "express";
import { describe, it, expect, vi } from "vitest";
import request from "supertest";

import { errorHandler, requestId } from "../middleware/errorHandler";
import { installBundleRoutes } from "./bundles";
import { BundleService } from "../services/bundles";
import { NotFoundError } from "../middleware/errors";

interface MockedService {
  list: ReturnType<typeof vi.fn>;
  getById: ReturnType<typeof vi.fn>;
  create: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
  softDelete: ReturnType<typeof vi.fn>;
  duplicate: ReturnType<typeof vi.fn>;
  publish: ReturnType<typeof vi.fn>;
  archive: ReturnType<typeof vi.fn>;
}

interface MockedActivityRepo {
  append: ReturnType<typeof vi.fn>;
  list: ReturnType<typeof vi.fn>;
}

function buildApp(
  service: MockedService,
  options: {
    withShop?: boolean;
    activityRepo?: MockedActivityRepo;
  } = {},
): Express {
  const { withShop = true, activityRepo } = options;
  const app = express();
  app.use(requestId);
  app.use(express.json());
  app.use((req, _res, next) => {
    if (withShop) req.shopId = "shop-uuid";
    next();
  });
  const deps: Record<string, unknown> = {
    service: service as unknown as BundleService,
  };
  if (activityRepo) deps.activityRepo = activityRepo;
  app.use(
    "/bundles",
    installBundleRoutes(deps as Parameters<typeof installBundleRoutes>[0]),
  );
  app.use(errorHandler);
  return app;
}

function mocked(): MockedService {
  return {
    list: vi.fn(),
    getById: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    softDelete: vi.fn(),
    duplicate: vi.fn(),
    publish: vi.fn(),
    archive: vi.fn(),
  };
}

describe("GET /bundles", () => {
  it("calls service.list with parsed pagination + filters", async () => {
    const svc = mocked();
    svc.list.mockResolvedValueOnce({ data: [], pagination: { total: 0 } });
    const app = buildApp(svc);
    const res = await request(app).get(
      "/bundles?page=2&limit=10&sortBy=title&sortOrder=asc&type=fixed&status=active&search=foo",
    );
    expect(res.status).toBe(200);
    expect(svc.list).toHaveBeenCalledWith(
      "shop-uuid",
      { page: 2, limit: 10, sortBy: "title", sortOrder: "asc" },
      { status: "active", type: "fixed", search: "foo" },
    );
  });
});

describe("POST /bundles", () => {
  it("creates and returns 201", async () => {
    const svc = mocked();
    svc.create.mockResolvedValueOnce({ id: "b-1", title: "X" });
    const app = buildApp(svc);
    const res = await request(app)
      .post("/bundles")
      .send({ title: "X", type: "fixed", items: [], pricingRules: [] });
    expect(res.status).toBe(201);
    expect(svc.create).toHaveBeenCalledTimes(1);
  });
});

describe("GET /bundles/:id", () => {
  it("returns 200 with detail", async () => {
    const svc = mocked();
    svc.getById.mockResolvedValueOnce({ id: "b-1" });
    const app = buildApp(svc);
    const res = await request(app).get("/bundles/b-1");
    expect(res.status).toBe(200);
  });

  it("404 when not found", async () => {
    const svc = mocked();
    svc.getById.mockRejectedValueOnce(new NotFoundError("Bundle"));
    const app = buildApp(svc);
    const res = await request(app).get("/bundles/missing");
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("not_found");
  });
});

describe("DELETE /bundles/:id", () => {
  it("returns 204", async () => {
    const svc = mocked();
    svc.softDelete.mockResolvedValueOnce(undefined);
    const app = buildApp(svc);
    const res = await request(app).delete("/bundles/b-1");
    expect(res.status).toBe(204);
  });
});

describe("POST /bundles/:id/{duplicate,publish,archive}", () => {
  it("duplicate -> 201", async () => {
    const svc = mocked();
    svc.duplicate.mockResolvedValueOnce({ id: "b-2" });
    const app = buildApp(svc);
    const res = await request(app).post("/bundles/b-1/duplicate");
    expect(res.status).toBe(201);
  });

  it("publish -> 200", async () => {
    const svc = mocked();
    svc.publish.mockResolvedValueOnce({ id: "b-1", status: "active" });
    const app = buildApp(svc);
    const res = await request(app).post("/bundles/b-1/publish");
    expect(res.status).toBe(200);
  });

  it("archive -> 200", async () => {
    const svc = mocked();
    svc.archive.mockResolvedValueOnce({ id: "b-1", status: "archived" });
    const app = buildApp(svc);
    const res = await request(app).post("/bundles/b-1/archive");
    expect(res.status).toBe(200);
  });
});

describe("Auth gate", () => {
  it("401 when req.shopId is missing", async () => {
    const svc = mocked();
    const app = buildApp(svc, { withShop: false });
    const res = await request(app).get("/bundles");
    expect(res.status).toBe(401);
  });
});

describe("GET /bundles/:id/activity (M-174)", () => {
  it("returns paginated activity rows newest first", async () => {
    const svc = mocked();
    svc.getById.mockResolvedValueOnce({ id: "b-1" });
    const activityRepo: MockedActivityRepo = {
      append: vi.fn(),
      list: vi.fn().mockResolvedValueOnce({
        data: [
          {
            id: "act-1",
            action: "published",
            summary: "Bundle published",
            createdAt: new Date(),
            metadata: {},
          },
        ],
        total: 1,
      }),
    };
    const app = buildApp(svc, { activityRepo });
    const res = await request(app).get("/bundles/b-1/activity");
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].action).toBe("published");
    expect(res.body.pagination.total).toBe(1);
    expect(activityRepo.list).toHaveBeenCalledWith("shop-uuid", "b-1", {
      page: 1,
      limit: 20,
    });
  });

  it("respects ?limit and ?page", async () => {
    const svc = mocked();
    svc.getById.mockResolvedValueOnce({ id: "b-1" });
    const activityRepo: MockedActivityRepo = {
      append: vi.fn(),
      list: vi.fn().mockResolvedValueOnce({ data: [], total: 0 }),
    };
    const app = buildApp(svc, { activityRepo });
    await request(app).get("/bundles/b-1/activity?page=3&limit=5");
    expect(activityRepo.list).toHaveBeenCalledWith("shop-uuid", "b-1", {
      page: 3,
      limit: 5,
    });
  });

  it("404 when the bundle is not in this shop", async () => {
    const svc = mocked();
    svc.getById.mockRejectedValueOnce(new NotFoundError("Bundle"));
    const activityRepo: MockedActivityRepo = {
      append: vi.fn(),
      list: vi.fn(),
    };
    const app = buildApp(svc, { activityRepo });
    const res = await request(app).get("/bundles/b-1/activity");
    expect(res.status).toBe(404);
    expect(activityRepo.list).not.toHaveBeenCalled();
  });
});
