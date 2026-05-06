import express, { type Express } from "express";
import { describe, it, expect, vi } from "vitest";
import request from "supertest";

import { errorHandler, requestId } from "../middleware/errorHandler";
import { installApiTokensRoutes, type ApiTokensClient } from "./apiTokens";

function buildApp(deps: {
  client: ApiTokensClient;
  shopId?: string;
  generateToken?: () => string;
  hashToken?: (s: string) => string;
}): Express {
  const app = express();
  app.use(requestId);
  app.use(express.json());
  app.use((req, _res, next) => {
    req.shopId = deps.shopId ?? "shop-uuid";
    next();
  });
  app.use(
    "/api-tokens",
    installApiTokensRoutes({
      client: deps.client,
      generateToken: deps.generateToken,
      hashToken: deps.hashToken,
    }),
  );
  app.use(errorHandler);
  return app;
}

function row(partial: Partial<{
  id: string;
  shopId: string;
  label: string;
  prefix: string;
  hashedToken: string;
  lastUsedAt: Date | null;
  createdAt: Date;
  revokedAt: Date | null;
}>) {
  return {
    id: "tok-1",
    shopId: "shop-uuid",
    label: "Test token",
    prefix: "bf_abcdefgh",
    hashedToken: "v1:salt:hash",
    lastUsedAt: null,
    createdAt: new Date("2026-05-06T12:00:00Z"),
    revokedAt: null,
    ...partial,
  };
}

describe("GET /api-tokens", () => {
  it("lists this shop's tokens without leaking the hash or plaintext", async () => {
    const client: ApiTokensClient = {
      apiToken: {
        findMany: vi.fn().mockResolvedValue([
          row({ id: "tok-1", label: "A", hashedToken: "v1:secret-hash" }),
          row({ id: "tok-2", label: "B", hashedToken: "v1:other-hash" }),
        ]),
        findFirst: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
    };
    const res = await request(buildApp({ client })).get("/api-tokens");
    expect(res.status).toBe(200);
    const body = JSON.stringify(res.body);
    expect(body).not.toContain("secret-hash");
    expect(body).not.toContain("other-hash");
    expect(res.body[0].id).toBe("tok-1");
    expect(res.body[1].id).toBe("tok-2");
  });

  it("scopes findMany to the request's shopId", async () => {
    const findManySpy = vi.fn().mockResolvedValue([]);
    const client: ApiTokensClient = {
      apiToken: {
        findMany: findManySpy,
        findFirst: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
    };
    await request(buildApp({ client, shopId: "shop-A" })).get("/api-tokens");
    expect(findManySpy).toHaveBeenCalledWith({
      where: { shopId: "shop-A" },
      orderBy: { createdAt: "desc" },
    });
  });
});

describe("POST /api-tokens", () => {
  it("returns the plaintext exactly once and persists the hash", async () => {
    const createSpy = vi.fn().mockImplementation(({ data }) =>
      Promise.resolve(row({ ...data })),
    );
    const client: ApiTokensClient = {
      apiToken: {
        findMany: vi.fn(),
        findFirst: vi.fn(),
        create: createSpy,
        update: vi.fn(),
      },
    };
    const res = await request(
      buildApp({
        client,
        generateToken: () => "bf_plaintext_test_value_xxxx",
        hashToken: (t) => `hashed:${t}`,
      }),
    )
      .post("/api-tokens")
      .send({ label: "Hydrogen storefront" });
    expect(res.status).toBe(201);
    expect(res.body.plaintext).toBe("bf_plaintext_test_value_xxxx");
    // `row()` default `label` is "Test token" but the create spy spreads the
    // POSTed `data` over the default, so the response label is "Hydrogen
    // storefront" (what the merchant just sent).
    expect(res.body.label).toBe("Hydrogen storefront");
    expect(createSpy).toHaveBeenCalledOnce();
    const dataArg = createSpy.mock.calls[0][0].data;
    expect(dataArg.hashedToken).toBe("hashed:bf_plaintext_test_value_xxxx");
    expect(dataArg.label).toBe("Hydrogen storefront");
    expect(dataArg.prefix).toBe("bf_plaintex");
  });

  it("rejects an empty label", async () => {
    const client: ApiTokensClient = {
      apiToken: {
        findMany: vi.fn(),
        findFirst: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
    };
    const res = await request(buildApp({ client }))
      .post("/api-tokens")
      .send({ label: "" });
    expect(res.status).toBe(400);
  });
});

describe("DELETE /api-tokens/:id", () => {
  it("soft-revokes by setting revokedAt", async () => {
    const updateSpy = vi.fn().mockImplementation(({ data }) =>
      Promise.resolve(row({ ...data })),
    );
    const client: ApiTokensClient = {
      apiToken: {
        findMany: vi.fn(),
        findFirst: vi.fn().mockResolvedValue(row({ id: "tok-7" })),
        create: vi.fn(),
        update: updateSpy,
      },
    };
    const res = await request(buildApp({ client })).delete(
      "/api-tokens/tok-7",
    );
    expect(res.status).toBe(204);
    expect(updateSpy).toHaveBeenCalledOnce();
    const dataArg = updateSpy.mock.calls[0][0].data;
    expect(dataArg.revokedAt).toBeInstanceOf(Date);
  });

  it("idempotent: returns 204 without calling update if already revoked", async () => {
    const updateSpy = vi.fn();
    const client: ApiTokensClient = {
      apiToken: {
        findMany: vi.fn(),
        findFirst: vi
          .fn()
          .mockResolvedValue(row({ id: "tok-9", revokedAt: new Date() })),
        create: vi.fn(),
        update: updateSpy,
      },
    };
    const res = await request(buildApp({ client })).delete(
      "/api-tokens/tok-9",
    );
    expect(res.status).toBe(204);
    expect(updateSpy).not.toHaveBeenCalled();
  });

  it("404 when the token doesn't exist for this shop (cross-tenant safety)", async () => {
    const client: ApiTokensClient = {
      apiToken: {
        findMany: vi.fn(),
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn(),
        update: vi.fn(),
      },
    };
    const res = await request(buildApp({ client })).delete(
      "/api-tokens/tok-of-another-shop",
    );
    expect(res.status).toBe(404);
  });
});
