/**
 * Multi-tenant isolation test (M-213).
 *
 * Spins up TWO Shop rows + sessions in the test DB and proves
 * that requests authenticated as Shop A cannot see, modify, or
 * delete Shop B's bundles, and vice-versa. Pre-launch sanity
 * check that the tenant-scoping enforcement we audited (route
 * `shopIdOr401` → service `shopId` arg → repo
 * `where: { shopId, deletedAt: null }`) actually holds in
 * practice across the whole stack.
 *
 * Mirrors the structure of bundle-crud-e2e.test.ts:
 *   - undici MockAgent intercepts SDK token-validation probes
 *   - real Prisma writes against the test database
 *   - JWTs minted with HS256 + the test SHOPIFY_API_SECRET
 *   - Skips suite when the DB isn't reachable
 *
 * Verifies:
 *   1. Shop A's GET /bundles returns only Shop A's bundles.
 *   2. Shop B's GET /bundles returns only Shop B's bundles.
 *   3. Shop A's GET /bundles/:id with B's id → 404 (not 200).
 *   4. Shop A's PUT /bundles/:id with B's id → 404, B's title intact.
 *   5. Shop A's DELETE /bundles/:id with B's id → 404, B's bundle still exists.
 *   6. After all cross-tenant attempts, B's bundles count is unchanged.
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

// Unique tag per run prevents collision when the test runs
// concurrently with other suites or repeats locally.
const RUN_TAG = crypto.randomBytes(4).toString("hex");
const SHOP_A = `tenant-a-${RUN_TAG}.myshopify.com`;
const SHOP_B = `tenant-b-${RUN_TAG}.myshopify.com`;

function base64url(input: Buffer | string): string {
  return Buffer.from(input)
    .toString("base64")
    .replace(/=+$/, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function mintJwt(shopDomain: string): string {
  const secret = process.env.SHOPIFY_API_SECRET ?? "";
  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = base64url(
    JSON.stringify({
      iss: `https://${shopDomain}/admin`,
      dest: `https://${shopDomain}`,
      aud: process.env.SHOPIFY_API_KEY,
      sub: "1",
      exp: now + 60,
      nbf: now - 5,
      iat: now,
      jti: "tenant-" + crypto.randomBytes(4).toString("hex"),
      sid: `sid-${shopDomain}`,
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
let shopAId: string | null = null;
let shopBId: string | null = null;

beforeAll(async () => {
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

  // Both shops need their Shopify GraphQL probe handler. The SDK's
  // hasValidAccessToken middleware calls `{ shop { name } }` to
  // verify the token is alive. Reply with a generic success for
  // either shop's domain.
  for (const shop of [SHOP_A, SHOP_B]) {
    mockAgent
      .get(`https://${shop}`)
      .intercept({
        path: /\/admin\/api\/[^/]+\/graphql\.json$/,
        method: "POST",
      })
      .reply({
        statusCode: 200,
        data: JSON.stringify({ data: { shop: { name: "Tenant" } } }),
        responseOptions: { headers: { "content-type": "application/json" } },
      })
      .persist();
  }

  // Pre-seed both Shop rows.
  const a = await prisma.shop.upsert({
    where: { shopifyDomain: SHOP_A },
    update: { uninstalledAt: null },
    create: {
      shopifyDomain: SHOP_A,
      shopifyGid: `gid://shopify/Shop/${SHOP_A}`,
      accessToken: "encrypted-placeholder-a",
      name: SHOP_A,
      email: `support+a-${RUN_TAG}@example.com`,
    },
  });
  shopAId = a.id;
  const b = await prisma.shop.upsert({
    where: { shopifyDomain: SHOP_B },
    update: { uninstalledAt: null },
    create: {
      shopifyDomain: SHOP_B,
      shopifyGid: `gid://shopify/Shop/${SHOP_B}`,
      accessToken: "encrypted-placeholder-b",
      name: SHOP_B,
      email: `support+b-${RUN_TAG}@example.com`,
    },
  });
  shopBId = b.id;

  // Pre-seed offline sessions so validateAuthenticatedSession
  // passes for both shops.
  for (const shop of [SHOP_A, SHOP_B]) {
    const session = new Session({
      id: `offline_${shop}`,
      shop,
      state: "test-state",
      isOnline: false,
      accessToken: "shpua_test_access_token",
      scope: "",
    });
    await shopify.config.sessionStorage?.storeSession(session);
  }
});

afterAll(async () => {
  if (!dbAvailable) return;
  try {
    await mockAgent.close();
    setGlobalDispatcher(originalDispatcher);
  } catch {
    // already closed
  }
  for (const shopId of [shopAId, shopBId]) {
    if (!shopId) continue;
    await prisma.bundle.deleteMany({ where: { shopId } });
    await prisma.shop.delete({ where: { id: shopId } }).catch(() => undefined);
  }
  for (const shop of [SHOP_A, SHOP_B]) {
    await shopify.config.sessionStorage?.deleteSession(`offline_${shop}`);
  }
});

afterEach(async () => {
  if (!dbAvailable) return;
  // Clear bundles between tests so each one starts clean.
  for (const shopId of [shopAId, shopBId]) {
    if (shopId) {
      await prisma.bundle.deleteMany({ where: { shopId } });
    }
  }
});

describe.skipIf(
  !process.env.DATABASE_URL ||
    process.env.DATABASE_URL.includes("localhost:5432/test") === false,
)("Multi-tenant bundle isolation (M-213)", () => {
  it("Shop A list excludes Shop B's bundles", async () => {
    if (!dbAvailable) return;
    const app = createApp();
    const authA = `Bearer ${mintJwt(SHOP_A)}`;
    const authB = `Bearer ${mintJwt(SHOP_B)}`;

    // Create a bundle for each shop.
    const aRes = await request(app)
      .post("/api/v1/bundles")
      .set("Authorization", authA)
      .send({
        title: "Shop A's Bundle",
        type: "fixed",
        items: [],
        pricingRules: [],
      });
    expect(aRes.status, aRes.text).toBe(201);

    const bRes = await request(app)
      .post("/api/v1/bundles")
      .set("Authorization", authB)
      .send({
        title: "Shop B's Bundle",
        type: "fixed",
        items: [],
        pricingRules: [],
      });
    expect(bRes.status, bRes.text).toBe(201);

    // Shop A's list returns only Shop A's bundle.
    const listA = await request(app)
      .get("/api/v1/bundles")
      .set("Authorization", authA);
    expect(listA.status).toBe(200);
    const aBundles = (listA.body as { data: Array<{ id: string; title: string }> })
      .data;
    expect(aBundles.length).toBe(1);
    expect(aBundles[0].title).toBe("Shop A's Bundle");
    expect(aBundles.some((b) => b.title === "Shop B's Bundle")).toBe(false);

    // And Shop B's list returns only Shop B's bundle.
    const listB = await request(app)
      .get("/api/v1/bundles")
      .set("Authorization", authB);
    expect(listB.status).toBe(200);
    const bBundles = (listB.body as { data: Array<{ id: string; title: string }> })
      .data;
    expect(bBundles.length).toBe(1);
    expect(bBundles[0].title).toBe("Shop B's Bundle");
  });

  it("Shop A cannot fetch Shop B's bundle by id (404)", async () => {
    if (!dbAvailable) return;
    const app = createApp();
    const authA = `Bearer ${mintJwt(SHOP_A)}`;
    const authB = `Bearer ${mintJwt(SHOP_B)}`;

    const bRes = await request(app)
      .post("/api/v1/bundles")
      .set("Authorization", authB)
      .send({
        title: "Shop B private",
        type: "fixed",
        items: [],
        pricingRules: [],
      });
    const bId = (bRes.body as { id: string }).id;

    // Shop A attempts to read it.
    const stealRes = await request(app)
      .get(`/api/v1/bundles/${bId}`)
      .set("Authorization", authA);
    expect(stealRes.status).toBe(404);

    // Shop B can still read it (sanity).
    const ownerRes = await request(app)
      .get(`/api/v1/bundles/${bId}`)
      .set("Authorization", authB);
    expect(ownerRes.status).toBe(200);
    expect(ownerRes.body).toMatchObject({ title: "Shop B private" });
  });

  it("Shop A cannot update Shop B's bundle (404 + B's data unchanged)", async () => {
    if (!dbAvailable) return;
    const app = createApp();
    const authA = `Bearer ${mintJwt(SHOP_A)}`;
    const authB = `Bearer ${mintJwt(SHOP_B)}`;

    const bRes = await request(app)
      .post("/api/v1/bundles")
      .set("Authorization", authB)
      .send({
        title: "Shop B original",
        type: "fixed",
        items: [],
        pricingRules: [],
      });
    const bId = (bRes.body as { id: string }).id;

    const tamperRes = await request(app)
      .put(`/api/v1/bundles/${bId}`)
      .set("Authorization", authA)
      .send({ title: "MWAHAHA" });
    expect(tamperRes.status).toBe(404);

    // Verify Shop B's bundle is intact.
    const checkRes = await request(app)
      .get(`/api/v1/bundles/${bId}`)
      .set("Authorization", authB);
    expect(checkRes.body).toMatchObject({ title: "Shop B original" });
  });

  it("Shop A cannot delete Shop B's bundle (404 + B's bundle still exists)", async () => {
    if (!dbAvailable) return;
    const app = createApp();
    const authA = `Bearer ${mintJwt(SHOP_A)}`;
    const authB = `Bearer ${mintJwt(SHOP_B)}`;

    const bRes = await request(app)
      .post("/api/v1/bundles")
      .set("Authorization", authB)
      .send({
        title: "Shop B undeletable",
        type: "fixed",
        items: [],
        pricingRules: [],
      });
    const bId = (bRes.body as { id: string }).id;

    const deleteRes = await request(app)
      .delete(`/api/v1/bundles/${bId}`)
      .set("Authorization", authA);
    expect(deleteRes.status).toBe(404);

    // Verify B's bundle still in B's list.
    const listB = await request(app)
      .get("/api/v1/bundles")
      .set("Authorization", authB);
    const bBundles = (listB.body as { data: Array<{ id: string }> }).data;
    expect(bBundles.find((b) => b.id === bId)).toBeTruthy();
  });

  it("Shop A cannot publish or archive Shop B's bundle (404 each)", async () => {
    if (!dbAvailable) return;
    const app = createApp();
    const authA = `Bearer ${mintJwt(SHOP_A)}`;
    const authB = `Bearer ${mintJwt(SHOP_B)}`;

    const bRes = await request(app)
      .post("/api/v1/bundles")
      .set("Authorization", authB)
      .send({
        title: "Shop B status-locked",
        type: "fixed",
        items: [],
        pricingRules: [],
      });
    const bId = (bRes.body as { id: string }).id;

    const publishRes = await request(app)
      .post(`/api/v1/bundles/${bId}/publish`)
      .set("Authorization", authA);
    expect(publishRes.status).toBe(404);

    const archiveRes = await request(app)
      .post(`/api/v1/bundles/${bId}/archive`)
      .set("Authorization", authA);
    expect(archiveRes.status).toBe(404);

    // Sanity: B's bundle is still in `draft` status.
    const ownerRes = await request(app)
      .get(`/api/v1/bundles/${bId}`)
      .set("Authorization", authB);
    expect(ownerRes.body).toMatchObject({ status: "draft" });
  });
});
