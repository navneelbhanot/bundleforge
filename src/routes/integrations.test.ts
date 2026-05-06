import express, { type Express } from "express";
import { describe, it, expect, vi } from "vitest";
import request from "supertest";

import { errorHandler, requestId } from "../middleware/errorHandler";
import {
  installIntegrationsRoutes,
  type IntegrationsClient,
} from "./integrations";
import type { IntegrationAdapter } from "../services/integrations/types";

function buildApp(deps: {
  client: IntegrationsClient;
  shopId?: string;
  getAdapter?: typeof import("../services/integrations/registry").getAdapter;
  encrypt?: (s: string) => string;
  decrypt?: (s: string) => string;
}): Express {
  const app = express();
  app.use(requestId);
  app.use(express.json());
  app.use((req, _res, next) => {
    req.shopId = deps.shopId ?? "shop-uuid";
    next();
  });
  app.use(
    "/integrations",
    installIntegrationsRoutes({
      client: deps.client,
      getAdapter: deps.getAdapter,
      encrypt: deps.encrypt,
      decrypt: deps.decrypt,
    }),
  );
  app.use(errorHandler);
  return app;
}

const fakeEncrypt = (s: string) => `v1:${s}`;
const fakeDecrypt = (s: string) =>
  s.startsWith("v1:") ? s.slice(3) : s;

function row(partial: Partial<{
  id: string;
  shopId: string;
  type: string;
  status: string;
  credentials: string;
  settings: unknown;
  lastSyncedAt: Date | null;
  errorMessage: string | null;
}>): {
  id: string;
  shopId: string;
  type: string;
  status: string;
  credentials: string;
  settings: unknown;
  lastSyncedAt: Date | null;
  errorMessage: string | null;
} {
  return {
    id: "row-1",
    shopId: "shop-uuid",
    type: "shipstation",
    status: "active",
    credentials: fakeEncrypt(JSON.stringify({ apiKey: "ak", apiSecret: "sk" })),
    settings: {},
    lastSyncedAt: null,
    errorMessage: null,
    ...partial,
  };
}

describe("GET /integrations", () => {
  it("lists every known adapter, marking unconfigured ones inactive", async () => {
    const client: IntegrationsClient = {
      integration: {
        findMany: vi.fn().mockResolvedValue([
          row({ type: "shipstation", status: "active" }),
        ]),
        findFirst: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
    };
    const res = await request(
      buildApp({ client, encrypt: fakeEncrypt, decrypt: fakeDecrypt }),
    ).get("/integrations");
    expect(res.status).toBe(200);
    const types = (res.body as Array<{ type: string; status: string }>).map(
      (r) => r.type,
    );
    expect(types).toEqual([
      "shipstation",
      "recharge",
      "bold",
      "klaviyo",
      "amazon",
      "google_merchant",
    ]);
    const shipstation = (res.body as Array<{ type: string; status: string }>)
      .find((r) => r.type === "shipstation")!;
    expect(shipstation.status).toBe("active");
    const klaviyo = (res.body as Array<{ type: string; status: string }>)
      .find((r) => r.type === "klaviyo")!;
    expect(klaviyo.status).toBe("inactive");
  });

  it("never returns credential values, only credentialKeys", async () => {
    const client: IntegrationsClient = {
      integration: {
        findMany: vi.fn().mockResolvedValue([
          row({
            type: "shipstation",
            credentials: fakeEncrypt(
              JSON.stringify({ apiKey: "secret-1", apiSecret: "secret-2" }),
            ),
          }),
        ]),
        findFirst: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
    };
    const res = await request(
      buildApp({ client, encrypt: fakeEncrypt, decrypt: fakeDecrypt }),
    ).get("/integrations");
    expect(res.status).toBe(200);
    const body = JSON.stringify(res.body);
    expect(body).not.toContain("secret-1");
    expect(body).not.toContain("secret-2");
    const shipstation = (
      res.body as Array<{ type: string; credentialKeys: string[] }>
    ).find((r) => r.type === "shipstation")!;
    expect(shipstation.credentialKeys.sort()).toEqual(["apiKey", "apiSecret"]);
  });
});

describe("PUT /integrations/:type", () => {
  it("encrypts credentials before persisting and creates a new row", async () => {
    const createSpy = vi.fn().mockImplementation(({ data }) =>
      Promise.resolve({
        ...row({}),
        ...data,
        lastSyncedAt: null,
        errorMessage: null,
      }),
    );
    const client: IntegrationsClient = {
      integration: {
        findMany: vi.fn(),
        findFirst: vi.fn().mockResolvedValue(null),
        create: createSpy,
        update: vi.fn(),
      },
    };
    const res = await request(
      buildApp({ client, encrypt: fakeEncrypt, decrypt: fakeDecrypt }),
    )
      .put("/integrations/shipstation")
      .send({
        credentials: { apiKey: "ak-new", apiSecret: "sk-new" },
      });
    expect(res.status).toBe(200);
    expect(createSpy).toHaveBeenCalledOnce();
    const dataArg = createSpy.mock.calls[0][0].data;
    expect(dataArg.type).toBe("shipstation");
    expect(dataArg.status).toBe("active");
    expect(dataArg.credentials).toMatch(/^v1:/);
    const decrypted = JSON.parse(fakeDecrypt(dataArg.credentials));
    expect(decrypted).toEqual({ apiKey: "ak-new", apiSecret: "sk-new" });
  });

  it("preserves prior credentials when a field is sent empty (leave-unchanged)", async () => {
    const updateSpy = vi.fn().mockImplementation(({ data }) =>
      Promise.resolve({
        ...row({}),
        ...data,
      }),
    );
    const client: IntegrationsClient = {
      integration: {
        findMany: vi.fn(),
        findFirst: vi.fn().mockResolvedValue(
          row({
            type: "shipstation",
            credentials: fakeEncrypt(
              JSON.stringify({ apiKey: "old-ak", apiSecret: "old-sk" }),
            ),
          }),
        ),
        create: vi.fn(),
        update: updateSpy,
      },
    };
    const res = await request(
      buildApp({ client, encrypt: fakeEncrypt, decrypt: fakeDecrypt }),
    )
      .put("/integrations/shipstation")
      .send({
        // only apiKey changed; apiSecret left blank means "leave alone"
        credentials: { apiKey: "new-ak", apiSecret: "" },
      });
    expect(res.status).toBe(200);
    const dataArg = updateSpy.mock.calls[0][0].data;
    const decrypted = JSON.parse(fakeDecrypt(dataArg.credentials));
    expect(decrypted).toEqual({ apiKey: "new-ak", apiSecret: "old-sk" });
  });

  it("rejects PUT to an unknown integration type", async () => {
    const client: IntegrationsClient = {
      integration: {
        findMany: vi.fn(),
        findFirst: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
    };
    const res = await request(
      buildApp({ client, encrypt: fakeEncrypt, decrypt: fakeDecrypt }),
    )
      .put("/integrations/squarespace")
      .send({ credentials: { apiKey: "x" } });
    expect(res.status).toBe(400);
  });

  it("rejects PUT to a feed-only integration", async () => {
    const client: IntegrationsClient = {
      integration: {
        findMany: vi.fn(),
        findFirst: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
    };
    const res = await request(
      buildApp({ client, encrypt: fakeEncrypt, decrypt: fakeDecrypt }),
    )
      .put("/integrations/google_merchant")
      .send({ credentials: { irrelevant: "x" } });
    expect(res.status).toBe(400);
  });
});

describe("POST /integrations/:type/test", () => {
  it("calls adapter.ping with the provided credentials and returns its result", async () => {
    const pingSpy = vi.fn().mockResolvedValue({ ok: true });
    const fakeAdapter: IntegrationAdapter = {
      type: "shipstation",
      ping: pingSpy,
    };
    const client: IntegrationsClient = {
      integration: {
        findMany: vi.fn(),
        findFirst: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
    };
    const res = await request(
      buildApp({
        client,
        encrypt: fakeEncrypt,
        decrypt: fakeDecrypt,
        getAdapter: () => fakeAdapter,
      }),
    )
      .post("/integrations/shipstation/test")
      .send({ credentials: { apiKey: "ak", apiSecret: "sk" } });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
    expect(pingSpy).toHaveBeenCalledWith({ apiKey: "ak", apiSecret: "sk" });
  });

  it("forwards a failed ping verbatim", async () => {
    const fakeAdapter: IntegrationAdapter = {
      type: "shipstation",
      ping: vi.fn().mockResolvedValue({ ok: false, message: "HTTP 401" }),
    };
    const client: IntegrationsClient = {
      integration: {
        findMany: vi.fn(),
        findFirst: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
    };
    const res = await request(
      buildApp({
        client,
        encrypt: fakeEncrypt,
        decrypt: fakeDecrypt,
        getAdapter: () => fakeAdapter,
      }),
    )
      .post("/integrations/shipstation/test")
      .send({ credentials: { apiKey: "bad", apiSecret: "creds" } });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: false, message: "HTTP 401" });
  });
});

describe("DELETE /integrations/:type", () => {
  it("soft-disables: status=inactive + clears credentials, keeps the row", async () => {
    const updateSpy = vi.fn().mockImplementation(({ data }) =>
      Promise.resolve({ ...row({}), ...data }),
    );
    const existing = row({ type: "shipstation", status: "active" });
    const client: IntegrationsClient = {
      integration: {
        findMany: vi.fn(),
        findFirst: vi.fn().mockResolvedValue(existing),
        create: vi.fn(),
        update: updateSpy,
      },
    };
    const res = await request(
      buildApp({ client, encrypt: fakeEncrypt, decrypt: fakeDecrypt }),
    ).delete("/integrations/shipstation");
    expect(res.status).toBe(204);
    expect(updateSpy).toHaveBeenCalledOnce();
    const dataArg = updateSpy.mock.calls[0][0].data;
    expect(dataArg.status).toBe("inactive");
    const decrypted = JSON.parse(fakeDecrypt(dataArg.credentials));
    expect(decrypted).toEqual({});
  });

  it("404s when the integration was never configured", async () => {
    const client: IntegrationsClient = {
      integration: {
        findMany: vi.fn(),
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn(),
        update: vi.fn(),
      },
    };
    const res = await request(
      buildApp({ client, encrypt: fakeEncrypt, decrypt: fakeDecrypt }),
    ).delete("/integrations/shipstation");
    expect(res.status).toBe(404);
  });
});

describe("Cross-tenant isolation", () => {
  it("findMany is always called with the request's shopId", async () => {
    const findManySpy = vi.fn().mockResolvedValue([]);
    const client: IntegrationsClient = {
      integration: {
        findMany: findManySpy,
        findFirst: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
    };
    await request(
      buildApp({
        client,
        shopId: "shop-A",
        encrypt: fakeEncrypt,
        decrypt: fakeDecrypt,
      }),
    ).get("/integrations");
    expect(findManySpy).toHaveBeenCalledWith({ where: { shopId: "shop-A" } });
  });
});
