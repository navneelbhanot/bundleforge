/**
 * Integration test: validateAuthenticatedSession against pre-seeded
 * sessions and a mocked Shopify GraphQL probe.
 *
 * This is the auth-flow follow-up to tests/integration/server-spa.ts
 * and tests/e2e/embedded-admin.spec.ts. It exercises the bug surface
 * those don't:
 *
 *   - Pre-seeded session storage gets accepted when isActive() returns
 *     true. Specifically: even with `scope: ""` on the session, the
 *     middleware must NOT 302-reauth (this was today's loop bug, which
 *     we fixed by dropping `scopes` from the API config so v13's
 *     isScopeChanged short-circuits).
 *   - JWTs signed with the wrong secret are rejected with 401 (the
 *     SDK's InvalidJwtError path), not silently accepted.
 *   - When no session exists in storage, the middleware redirects to
 *     /api/auth — i.e. the OAuth re-auth path is still wired up for
 *     a fresh shop.
 *
 * Setup:
 *   - undici MockAgent intercepts the Shopify GraphQL probe that
 *     hasValidAccessToken issues, so we don't need a real shop.
 *   - The SDK is built with MemorySessionStorage (default under
 *     NODE_ENV=test) so we can preseed sessions in-process.
 *   - JWTs are minted manually with crypto.HMAC-SHA256 + the test
 *     SHOPIFY_API_SECRET.
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

// Match values from tests/setup.ts. They must agree because the JWT
// `aud` claim is verified against process.env.SHOPIFY_API_KEY and the
// signature is verified with process.env.SHOPIFY_API_SECRET.
const SHOP = "demo.myshopify.com";

function base64url(input: Buffer | string): string {
  return Buffer.from(input)
    .toString("base64")
    .replace(/=+$/, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

interface JwtClaims {
  aud?: string;
  iss?: string;
  dest?: string;
  exp?: number;
  nbf?: number;
  iat?: number;
  sub?: string;
  jti?: string;
  sid?: string;
}

function mintJwt(claims: JwtClaims, secret = process.env.SHOPIFY_API_SECRET ?? ""): string {
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
      jti: "test-" + Math.random().toString(36).slice(2),
      sid: "test-sid",
      ...claims,
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

beforeAll(async () => {
  originalDispatcher = getGlobalDispatcher();
  mockAgent = new MockAgent();
  mockAgent.disableNetConnect();
  setGlobalDispatcher(mockAgent);

  // hasValidAccessToken() runs a GraphQL POST against the shop's
  // admin API — intercept and return a successful payload so the
  // session is treated as having a live access token.
  mockAgent
    .get(`https://${SHOP}`)
    .intercept({
      path: /\/admin\/api\/[^/]+\/graphql\.json$/,
      method: "POST",
    })
    .reply(
      200,
      JSON.stringify({ data: { shop: { name: "Demo" } } }),
      { headers: { "content-type": "application/json" } },
    )
    .persist();
});

afterAll(async () => {
  await mockAgent.close();
  setGlobalDispatcher(originalDispatcher);
});

afterEach(async () => {
  // Reset session storage between tests so each one starts clean.
  const storage = shopify.config.sessionStorage;
  if (storage) {
    const id = `offline_${SHOP}`;
    try {
      await storage.deleteSession(id);
    } catch {
      // session may not exist — fine
    }
  }
});

async function seedOfflineSession(opts: {
  shop?: string;
  accessToken?: string;
  scope?: string;
} = {}): Promise<void> {
  const shop = opts.shop ?? SHOP;
  const session = new Session({
    id: `offline_${shop}`,
    shop,
    state: "test-state",
    isOnline: false,
    accessToken: opts.accessToken ?? "shpua_test_access_token",
    scope: opts.scope,
  });
  const storage = shopify.config.sessionStorage;
  if (!storage) throw new Error("Shopify session storage missing");
  await storage.storeSession(session);
}

describe("validateAuthenticatedSession", () => {
  it("accepts a valid JWT for a pre-seeded offline session (no reauth loop)", async () => {
    await seedOfflineSession({ scope: "" });
    const app = createApp();
    const jwt = mintJwt({});

    const res = await request(app)
      .get("/api/v1/bundles")
      .set("Authorization", `Bearer ${jwt}`);

    // The middleware must NOT redirect to OAuth and must NOT emit the
    // X-Shopify-Api-Request-Failure-Reauthorize header — that header
    // is what App Bridge sees and turns into the reload loop.
    expect(res.status).not.toBe(302);
    expect(
      res.headers["x-shopify-api-request-failure-reauthorize"],
      "the v13 scope-mismatch reauth bug must not regress",
    ).toBeUndefined();
  });

  it("rejects a JWT signed with the wrong secret (InvalidJwt → 401)", async () => {
    await seedOfflineSession({ scope: "" });
    const app = createApp();
    const jwt = mintJwt({}, "definitely-the-wrong-secret");

    const res = await request(app)
      .get("/api/v1/bundles")
      .set("Authorization", `Bearer ${jwt}`);

    // SDK throws InvalidJwtError → handleSessionError → 401.
    expect(res.status).toBe(401);
  });

  it("redirects to /api/auth when no session exists for the shop yet", async () => {
    // No seedOfflineSession() — fresh shop, no record.
    const app = createApp();
    const jwt = mintJwt({});

    const res = await request(app)
      .get("/api/v1/bundles")
      .set("Authorization", `Bearer ${jwt}`);

    // Either an in-band 302 OR the reauthorize-header response,
    // depending on whether App Bridge headers are emitted on this
    // path. Both indicate the OAuth flow is still reachable for
    // a fresh install.
    const reauthHeader =
      res.headers["x-shopify-api-request-failure-reauthorize"];
    expect(
      res.status === 302 || reauthHeader === "1",
      `expected redirect or reauthorize header — got status=${res.status}, header=${reauthHeader ?? "(none)"}`,
    ).toBe(true);
  });
});
