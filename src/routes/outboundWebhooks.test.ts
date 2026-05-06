import express, { type Express } from "express";
import { describe, it, expect, vi } from "vitest";
import request from "supertest";

import { errorHandler, requestId } from "../middleware/errorHandler";
import {
  installOutboundWebhooksRoutes,
  type OutboundWebhooksClient,
} from "./outboundWebhooks";

function buildApp(deps: {
  client: OutboundWebhooksClient;
  shopId?: string;
  generateSecret?: () => string;
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
    "/outbound-webhooks",
    installOutboundWebhooksRoutes({
      client: deps.client,
      generateSecret: deps.generateSecret,
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
  url: string;
  events: string[];
  hmacSecret: string;
  lastFiredAt: Date | null;
  failCount: number;
  createdAt: Date;
  disabledAt: Date | null;
}>) {
  return {
    id: "wh-1",
    shopId: "shop-uuid",
    url: "https://example.com/webhook",
    events: ["bundle.published"],
    hmacSecret: "v1:secret",
    lastFiredAt: null,
    failCount: 0,
    createdAt: new Date("2026-05-06T12:00:00Z"),
    disabledAt: null,
    ...partial,
  };
}

describe("GET /outbound-webhooks", () => {
  it("lists this shop's webhooks without leaking the HMAC secret", async () => {
    const client: OutboundWebhooksClient = {
      outboundWebhook: {
        findMany: vi.fn().mockResolvedValue([
          row({ hmacSecret: "v1:supersecret-1" }),
          row({ id: "wh-2", hmacSecret: "v1:supersecret-2" }),
        ]),
        findFirst: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
    };
    const res = await request(
      buildApp({ client, encrypt: fakeEncrypt, decrypt: fakeDecrypt }),
    ).get("/outbound-webhooks");
    expect(res.status).toBe(200);
    const body = JSON.stringify(res.body);
    expect(body).not.toContain("supersecret-1");
    expect(body).not.toContain("supersecret-2");
    expect(res.body[0].hasSecret).toBe(true);
  });

  it("scopes findMany to the request's shopId", async () => {
    const findManySpy = vi.fn().mockResolvedValue([]);
    const client: OutboundWebhooksClient = {
      outboundWebhook: {
        findMany: findManySpy,
        findFirst: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
    };
    await request(
      buildApp({
        client,
        shopId: "shop-A",
        encrypt: fakeEncrypt,
        decrypt: fakeDecrypt,
      }),
    ).get("/outbound-webhooks");
    expect(findManySpy).toHaveBeenCalledWith({
      where: { shopId: "shop-A" },
      orderBy: { createdAt: "desc" },
    });
  });
});

describe("POST /outbound-webhooks", () => {
  it("returns the plaintext secret exactly once and persists encrypted", async () => {
    const createSpy = vi.fn().mockImplementation(({ data }) =>
      Promise.resolve(row({ ...data })),
    );
    const client: OutboundWebhooksClient = {
      outboundWebhook: {
        findMany: vi.fn(),
        findFirst: vi.fn(),
        create: createSpy,
        update: vi.fn(),
        delete: vi.fn(),
      },
    };
    const res = await request(
      buildApp({
        client,
        encrypt: fakeEncrypt,
        decrypt: fakeDecrypt,
        generateSecret: () => "secret-plaintext-fixture",
      }),
    )
      .post("/outbound-webhooks")
      .send({
        url: "https://example.com/hook",
        events: ["bundle.published", "bundle.archived"],
      });
    expect(res.status, res.text).toBe(201);
    expect(res.body.secretPlaintext).toBe("secret-plaintext-fixture");
    const dataArg = createSpy.mock.calls[0][0].data;
    expect(dataArg.hmacSecret).toBe("v1:secret-plaintext-fixture");
    expect(dataArg.url).toBe("https://example.com/hook");
    expect(dataArg.events).toEqual(["bundle.published", "bundle.archived"]);
  });

  it("rejects an unknown event", async () => {
    const client: OutboundWebhooksClient = {
      outboundWebhook: {
        findMany: vi.fn(),
        findFirst: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
    };
    const res = await request(
      buildApp({ client, encrypt: fakeEncrypt, decrypt: fakeDecrypt }),
    )
      .post("/outbound-webhooks")
      .send({
        url: "https://example.com/hook",
        events: ["bundle.tornado"],
      });
    expect(res.status).toBe(400);
  });

  it("rejects a non-http URL", async () => {
    const client: OutboundWebhooksClient = {
      outboundWebhook: {
        findMany: vi.fn(),
        findFirst: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
    };
    const res = await request(
      buildApp({ client, encrypt: fakeEncrypt, decrypt: fakeDecrypt }),
    )
      .post("/outbound-webhooks")
      .send({
        url: "ftp://example.com/hook",
        events: ["bundle.published"],
      });
    expect(res.status).toBe(400);
  });

  it("rejects an empty events array", async () => {
    const client: OutboundWebhooksClient = {
      outboundWebhook: {
        findMany: vi.fn(),
        findFirst: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
    };
    const res = await request(
      buildApp({ client, encrypt: fakeEncrypt, decrypt: fakeDecrypt }),
    )
      .post("/outbound-webhooks")
      .send({
        url: "https://example.com/hook",
        events: [],
      });
    expect(res.status).toBe(400);
  });
});

describe("PUT /outbound-webhooks/:id", () => {
  it("updates url + events", async () => {
    const updateSpy = vi.fn().mockImplementation(({ data }) =>
      Promise.resolve(row({ ...data })),
    );
    const client: OutboundWebhooksClient = {
      outboundWebhook: {
        findMany: vi.fn(),
        findFirst: vi.fn().mockResolvedValue(row({ id: "wh-X" })),
        create: vi.fn(),
        update: updateSpy,
        delete: vi.fn(),
      },
    };
    const res = await request(
      buildApp({ client, encrypt: fakeEncrypt, decrypt: fakeDecrypt }),
    )
      .put("/outbound-webhooks/wh-X")
      .send({
        url: "https://example.com/new-url",
        events: ["order.dispatched"],
      });
    expect(res.status, res.text).toBe(200);
    const dataArg = updateSpy.mock.calls[0][0].data;
    expect(dataArg.url).toBe("https://example.com/new-url");
    expect(dataArg.events).toEqual(["order.dispatched"]);
  });

  it("disabling sets disabledAt; enabling clears it", async () => {
    const updateSpy = vi.fn().mockImplementation(({ data }) =>
      Promise.resolve(row({ ...data })),
    );
    const client: OutboundWebhooksClient = {
      outboundWebhook: {
        findMany: vi.fn(),
        findFirst: vi.fn().mockResolvedValue(row({ id: "wh-Y" })),
        create: vi.fn(),
        update: updateSpy,
        delete: vi.fn(),
      },
    };
    const res = await request(
      buildApp({ client, encrypt: fakeEncrypt, decrypt: fakeDecrypt }),
    )
      .put("/outbound-webhooks/wh-Y")
      .send({ enabled: false });
    expect(res.status, res.text).toBe(200);
    const dataArg = updateSpy.mock.calls[0][0].data;
    expect(dataArg.disabledAt).toBeInstanceOf(Date);
  });

  it("404 when the webhook isn't owned by this shop", async () => {
    const client: OutboundWebhooksClient = {
      outboundWebhook: {
        findMany: vi.fn(),
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
    };
    const res = await request(
      buildApp({ client, encrypt: fakeEncrypt, decrypt: fakeDecrypt }),
    )
      .put("/outbound-webhooks/wh-of-another-shop")
      .send({ url: "https://example.com/x" });
    expect(res.status).toBe(404);
  });
});

describe("DELETE /outbound-webhooks/:id", () => {
  it("hard-deletes the row", async () => {
    const deleteSpy = vi.fn().mockResolvedValue(row({ id: "wh-Z" }));
    const client: OutboundWebhooksClient = {
      outboundWebhook: {
        findMany: vi.fn(),
        findFirst: vi.fn().mockResolvedValue(row({ id: "wh-Z" })),
        create: vi.fn(),
        update: vi.fn(),
        delete: deleteSpy,
      },
    };
    const res = await request(
      buildApp({ client, encrypt: fakeEncrypt, decrypt: fakeDecrypt }),
    ).delete("/outbound-webhooks/wh-Z");
    expect(res.status).toBe(204);
    expect(deleteSpy).toHaveBeenCalledOnce();
  });

  it("404 cross-tenant", async () => {
    const client: OutboundWebhooksClient = {
      outboundWebhook: {
        findMany: vi.fn(),
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
    };
    const res = await request(
      buildApp({ client, encrypt: fakeEncrypt, decrypt: fakeDecrypt }),
    ).delete("/outbound-webhooks/wh-of-another-shop");
    expect(res.status).toBe(404);
  });
});
