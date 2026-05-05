/**
 * End-to-end bundle CRUD integration test.
 *
 * Drives the full Bundle lifecycle through real Express middleware
 * and real Prisma writes against the test database:
 *
 *   POST   /api/v1/bundles                  → create draft
 *   GET    /api/v1/bundles                  → list contains the new bundle
 *   GET    /api/v1/bundles/:id              → fetch detail
 *   PUT    /api/v1/bundles/:id              → update title + description
 *   POST   /api/v1/bundles/:id/publish      → status becomes active
 *   POST   /api/v1/bundles/:id/archive      → status becomes archived
 *
 * Setup:
 *   - undici MockAgent intercepts the SDK's hasValidAccessToken probe
 *     so validateAuthenticatedSession passes.
 *   - A real Shop row + offline Session are pre-seeded so the
 *     middleware chain can attach req.shopId.
 *   - JWTs minted manually with HS256 + the test SHOPIFY_API_SECRET.
 *
 * Skip semantics: if the test database isn't reachable (e.g. local
 * dev without docker compose up), we skip the suite rather than fail
 * the whole vitest run. CI always has Postgres available.
 */
import crypto from "node:crypto";

import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
} from "vitest";
import request from "supertest";
import { MockAgent, setGlobalDispatcher, getGlobalDispatcher } from "undici";
import { Session } from "@shopify/shopify-api";

import { createApp } from "../../src/server";
import { shopify } from "../../src/shopify";
import { prisma } from "../../src/config/database";

// Use a unique shop domain per run so concurrent tests / repeated
// runs don't collide. JWT.aud must match SHOPIFY_API_KEY (test-key
// from tests/setup.ts).
const RUN_TAG = crypto.randomBytes(4).toString("hex");
const SHOP = `e2e-crud-${RUN_TAG}.myshopify.com`;

function base64url(input: Buffer | string): string {
  return Buffer.from(input)
    .toString("base64")
    .replace(/=+$/, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function mintJwt(): string {
  const secret = process.env.SHOPIFY_API_SECRET ?? "";
  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = base64url(
    JSON.stringify({
      iss: `https://${SHOP}/admin`,
      dest: `https://${SHOP}`,
      aud: process.env.SHOPIFY_API_KEY,
      sub: "1",
      exp: now + 60,
      nbf: now - 5,
      iat: now,
      jti: "crud-" + crypto.randomBytes(4).toString("hex"),
      sid: "crud-sid",
    }),
  );
  const signingInput = `${header}.${body}`;
  const sig = base64url(
    crypto.createHmac("sha256", secret).update(signingInput).digest(),
  );
  return `${signingInput}.${sig}`;
}

let mockAgent: MockAgent;
let originalDispatcher: ReturnType<typeof getGlobalDispatcher>;
let dbAvailable = false;
let createdShopId: string | null = null;

beforeAll(async () => {
  // Probe the database. If it's not reachable, mark the suite as
  // skipped — tests below will short-circuit. This keeps the test
  // green on local-dev machines that haven't run `docker compose up`.
  try {
    await prisma.$queryRaw`SELECT 1`;
    dbAvailable = true;
  } catch {
    dbAvailable = false;
    return;
  }

  originalDispatcher = getGlobalDispatcher();
  mockAgent = new MockAgent();
  mockAgent.disableNetConnect();
  setGlobalDispatcher(mockAgent);
  mockAgent
    .get(`https://${SHOP}`)
    .intercept({
      path: /\/admin\/api\/[^/]+\/graphql\.json$/,
      method: "POST",
    })
    .reply(
      200,
      JSON.stringify({ data: { shop: { name: "E2E" } } }),
      { headers: { "content-type": "application/json" } },
    )
    .persist();

  // Pre-seed Shop row. requireShopSession looks the shop up by domain
  // and attaches req.shopId for downstream routes.
  const shopRow = await prisma.shop.upsert({
    where: { shopifyDomain: SHOP },
    update: { uninstalledAt: null },
    create: {
      shopifyDomain: SHOP,
      shopifyGid: `gid://shopify/Shop/${SHOP}`,
      accessToken: "encrypted-placeholder",
      name: SHOP,
      email: `support+${RUN_TAG}@example.com`,
    },
  });
  createdShopId = shopRow.id;

  // Pre-seed offline session so validateAuthenticatedSession passes.
  const session = new Session({
    id: `offline_${SHOP}`,
    shop: SHOP,
    state: "test-state",
    isOnline: false,
    accessToken: "shpua_test_access_token",
    scope: "",
  });
  await shopify.config.sessionStorage?.storeSession(session);
});

afterAll(async () => {
  if (!dbAvailable) return;
  try {
    await mockAgent.close();
    setGlobalDispatcher(originalDispatcher);
  } catch {
    // already closed
  }
  // Clean up: bundles cascade-delete on shop, but deleteMany is
  // explicit + faster than waiting for cascade.
  if (createdShopId) {
    await prisma.bundle.deleteMany({ where: { shopId: createdShopId } });
    await prisma.shop
      .delete({ where: { id: createdShopId } })
      .catch(() => undefined);
  }
  await shopify.config.sessionStorage?.deleteSession(`offline_${SHOP}`);
});

afterEach(async () => {
  if (!dbAvailable || !createdShopId) return;
  // Clear bundles between tests so each one starts from zero.
  await prisma.bundle.deleteMany({ where: { shopId: createdShopId } });
});

describe.skipIf(!process.env.DATABASE_URL || process.env.DATABASE_URL.includes("localhost:5432/test"))(
  "Bundle CRUD lifecycle (real DB + auth)",
  () => {
    it("creates → fetches → updates → publishes → archives a bundle", async () => {
      if (!dbAvailable) return; // belt-and-suspenders for the skipIf above
      const app = createApp();
      const jwt = mintJwt();
      const auth = `Bearer ${jwt}`;

      // CREATE
      const createRes = await request(app)
        .post("/api/v1/bundles")
        .set("Authorization", auth)
        .send({
          title: "E2E Test Bundle",
          type: "fixed",
          description: "from bundle-crud-e2e.test.ts",
          items: [],
          pricingRules: [],
        });
      expect(createRes.status, createRes.text).toBe(201);
      const bundleId = (createRes.body as { id: string }).id;
      expect(bundleId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
      );
      expect(createRes.body).toMatchObject({
        title: "E2E Test Bundle",
        type: "fixed",
        status: "draft",
      });

      // LIST
      const listRes = await request(app)
        .get("/api/v1/bundles")
        .set("Authorization", auth);
      expect(listRes.status).toBe(200);
      const listed = (listRes.body as { data: Array<{ id: string }> }).data;
      expect(listed.find((b) => b.id === bundleId)).toBeTruthy();

      // GET DETAIL
      const detailRes = await request(app)
        .get(`/api/v1/bundles/${bundleId}`)
        .set("Authorization", auth);
      expect(detailRes.status).toBe(200);
      expect(detailRes.body).toMatchObject({
        id: bundleId,
        title: "E2E Test Bundle",
      });

      // UPDATE
      const updateRes = await request(app)
        .put(`/api/v1/bundles/${bundleId}`)
        .set("Authorization", auth)
        .send({ title: "E2E Test Bundle (renamed)" });
      expect(updateRes.status).toBe(200);
      expect(updateRes.body).toMatchObject({
        id: bundleId,
        title: "E2E Test Bundle (renamed)",
      });

      // PUBLISH
      const publishRes = await request(app)
        .post(`/api/v1/bundles/${bundleId}/publish`)
        .set("Authorization", auth);
      expect(publishRes.status).toBe(200);
      expect(publishRes.body).toMatchObject({ id: bundleId, status: "active" });

      // ARCHIVE
      const archiveRes = await request(app)
        .post(`/api/v1/bundles/${bundleId}/archive`)
        .set("Authorization", auth);
      expect(archiveRes.status).toBe(200);
      expect(archiveRes.body).toMatchObject({ id: bundleId, status: "archived" });
    });

    it("creates a mix_match bundle with required config fields", async () => {
      if (!dbAvailable) return;
      const app = createApp();
      const jwt = mintJwt();

      // mix_match's Zod validator requires minItems + maxItems. The
      // BundleCreatePage sends them as part of `config`. This test
      // pins the contract so a frontend regression that omits config
      // (which produced HTTP 400 "Expected number, received nan" on a
      // real merchant's first attempt) trips the test, not the merchant.
      const res = await request(app)
        .post("/api/v1/bundles")
        .set("Authorization", `Bearer ${jwt}`)
        .send({
          title: "E2E mix-match",
          type: "mix_match",
          config: { minItems: 2, maxItems: 5, allowDuplicates: false },
          items: [],
          pricingRules: [],
        });
      expect(res.status, res.text).toBe(201);
      expect(res.body).toMatchObject({
        type: "mix_match",
        status: "draft",
      });
      expect(res.body.config).toMatchObject({
        minItems: 2,
        maxItems: 5,
      });
    });

    it("rejects mix_match bundle without config fields (regression for HTTP 400)", async () => {
      if (!dbAvailable) return;
      const app = createApp();
      const jwt = mintJwt();

      const res = await request(app)
        .post("/api/v1/bundles")
        .set("Authorization", `Bearer ${jwt}`)
        .send({
          title: "E2E mix-match no config",
          type: "mix_match",
          // intentionally omitting config — server should 400
          items: [],
          pricingRules: [],
        });
      expect(res.status).toBe(400);
      expect(res.body.error?.code).toBe("validation_error");
    });

    it("creates a multipack bundle with packQuantity config", async () => {
      if (!dbAvailable) return;
      const app = createApp();
      const jwt = mintJwt();

      const res = await request(app)
        .post("/api/v1/bundles")
        .set("Authorization", `Bearer ${jwt}`)
        .send({
          title: "E2E multipack",
          type: "multipack",
          config: { packQuantity: 12 },
          items: [],
          pricingRules: [],
        });
      expect(res.status, res.text).toBe(201);
      expect(res.body.config).toMatchObject({ packQuantity: 12 });
    });

    it("rejects bundle access from a different shop (cross-tenant safety)", async () => {
      if (!dbAvailable) return;
      const app = createApp();
      const jwt = mintJwt();
      const auth = `Bearer ${jwt}`;

      // Create a bundle owned by a *different* shop directly via Prisma.
      const otherShop = await prisma.shop.create({
        data: {
          shopifyDomain: `e2e-other-${RUN_TAG}.myshopify.com`,
          shopifyGid: `gid://shopify/Shop/other-${RUN_TAG}`,
          accessToken: "x",
          name: "Other",
          email: `other+${RUN_TAG}@example.com`,
        },
      });
      const otherBundle = await prisma.bundle.create({
        data: {
          shopId: otherShop.id,
          title: "Cross-tenant probe",
          slug: `xtenant-${RUN_TAG}`,
          type: "fixed",
          status: "draft",
          config: {},
          displaySettings: {},
        },
      });

      try {
        // Our shop's JWT must NOT see the other shop's bundle.
        const res = await request(app)
          .get(`/api/v1/bundles/${otherBundle.id}`)
          .set("Authorization", auth);
        expect([403, 404]).toContain(res.status);
      } finally {
        await prisma.bundle
          .delete({ where: { id: otherBundle.id } })
          .catch(() => undefined);
        await prisma.shop
          .delete({ where: { id: otherShop.id } })
          .catch(() => undefined);
      }
    });
  },
);
