import express, { type Express } from "express";
import { describe, it, expect, vi } from "vitest";
import request from "supertest";
import type { Session } from "@shopify/shopify-api";

import { errorHandler, requestId } from "../middleware/errorHandler";
import {
  installSettingsLogoRoutes,
  type SettingsLogoDeps,
} from "./settingsLogo";

interface BuildOpts extends SettingsLogoDeps {
  withShop?: boolean;
  withSession?: boolean;
}

function buildApp(opts: BuildOpts = {}): Express {
  const { withShop = true, withSession = true, ...deps } = opts;
  const app = express();
  app.use(requestId);
  app.use(express.json({ limit: "10mb" }));
  app.use((req, res, next) => {
    if (withShop) req.shopId = "shop-uuid";
    if (withSession) {
      const locals = res.locals as { shopify?: { session?: Session } };
      locals.shopify = {
        session: { shop: "test.myshopify.com" } as unknown as Session,
      };
    }
    next();
  });
  app.use("/settings", installSettingsLogoRoutes(deps));
  app.use(errorHandler);
  return app;
}

const TINY_PNG_BASE64 = Buffer.from([0x89, 0x50, 0x4e, 0x47]).toString(
  "base64",
);

function happyDeps(overrides: Partial<SettingsLogoDeps> = {}): SettingsLogoDeps {
  const stagedTarget = {
    url: "https://example-staged.shopifycloud.com/staging/123",
    resourceUrl: "https://shopify-staged-uploads/123",
    parameters: [{ name: "x-goog-meta-shopify", value: "v" }],
  };
  const graphql = vi.fn(async (_session, query) => {
    if (query.includes("stagedUploadsCreate")) {
      return {
        stagedUploadsCreate: { stagedTargets: [stagedTarget], userErrors: [] },
      };
    }
    if (query.includes("fileCreate")) {
      return {
        fileCreate: {
          files: [
            {
              id: "gid://shopify/MediaImage/999",
              fileStatus: "READY",
              image: { url: "https://cdn.shopify.com/.../logo.png" },
            },
          ],
          userErrors: [],
        },
      };
    }
    if (query.includes("MintBundleFile(")) {
      return {
        node: {
          id: "gid://shopify/MediaImage/999",
          fileStatus: "READY",
          image: { url: "https://cdn.shopify.com/.../logo.png" },
        },
      };
    }
    throw new Error(`unexpected query: ${query.slice(0, 60)}`);
  });
  const upload = vi.fn().mockResolvedValue(undefined);
  return {
    shopifyGraphqlImpl: graphql as unknown as SettingsLogoDeps["shopifyGraphqlImpl"],
    uploadFn: upload,
    pollSleepMs: 0,
    maxPollAttempts: 1,
    ...overrides,
  };
}

describe("POST /settings/logo (M-167b)", () => {
  it("happy path: returns a Shopify CDN url", async () => {
    const deps = happyDeps();
    const app = buildApp(deps);
    const res = await request(app)
      .post("/settings/logo")
      .send({
        filename: "logo.png",
        mimeType: "image/png",
        dataBase64: TINY_PNG_BASE64,
      });
    expect(res.status).toBe(200);
    expect(res.body.url).toBe("https://cdn.shopify.com/.../logo.png");
    expect(res.body.fileId).toBe("gid://shopify/MediaImage/999");
    expect(deps.uploadFn).toHaveBeenCalledTimes(1);
  });

  it("rejects an unsupported mimeType", async () => {
    const app = buildApp(happyDeps());
    const res = await request(app)
      .post("/settings/logo")
      .send({
        filename: "logo.tiff",
        mimeType: "image/tiff",
        dataBase64: TINY_PNG_BASE64,
      });
    expect(res.status).toBe(400);
  });

  it("rejects an oversize file (decoded > 2 MiB)", async () => {
    const app = buildApp(happyDeps());
    // 3 MiB of zero bytes.
    const big = Buffer.alloc(3 * 1024 * 1024).toString("base64");
    const res = await request(app)
      .post("/settings/logo")
      .send({
        filename: "huge.png",
        mimeType: "image/png",
        dataBase64: big,
      });
    expect(res.status).toBe(400);
  });

  it("returns 504 when polling never resolves a READY file", async () => {
    const stagedTarget = {
      url: "https://staged",
      resourceUrl: "https://res",
      parameters: [],
    };
    const graphql = vi.fn(async (_s, query) => {
      if (query.includes("stagedUploadsCreate")) {
        return {
          stagedUploadsCreate: {
            stagedTargets: [stagedTarget],
            userErrors: [],
          },
        };
      }
      if (query.includes("fileCreate")) {
        return {
          fileCreate: {
            files: [
              {
                id: "gid://shopify/MediaImage/1",
                fileStatus: "PROCESSING",
                image: null,
                preview: null,
              },
            ],
            userErrors: [],
          },
        };
      }
      // Polling: stays PROCESSING forever.
      return {
        node: {
          id: "gid://shopify/MediaImage/1",
          fileStatus: "PROCESSING",
          image: null,
          preview: null,
        },
      };
    });
    const app = buildApp({
      shopifyGraphqlImpl:
        graphql as unknown as SettingsLogoDeps["shopifyGraphqlImpl"],
      uploadFn: vi.fn().mockResolvedValue(undefined),
      pollSleepMs: 0,
      maxPollAttempts: 2,
    });
    const res = await request(app)
      .post("/settings/logo")
      .send({
        filename: "logo.png",
        mimeType: "image/png",
        dataBase64: TINY_PNG_BASE64,
      });
    expect(res.status).toBe(504);
  });

  it("requires a shop session", async () => {
    const app = buildApp({ ...happyDeps(), withSession: false });
    const res = await request(app)
      .post("/settings/logo")
      .send({
        filename: "logo.png",
        mimeType: "image/png",
        dataBase64: TINY_PNG_BASE64,
      });
    expect(res.status).toBe(401);
  });
});
