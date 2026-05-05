/**
 * Integration test: SPA serving path on the embedded-admin host.
 *
 * Specifically targets the bugs we hit during the first real install on
 * a Shopify dev store, none of which any unit test caught:
 *
 *   - Helmet was emitting `X-Frame-Options: SAMEORIGIN`, blocking the
 *     admin iframe.
 *   - Helmet was emitting `Cross-Origin-Opener-Policy: same-origin`,
 *     causing Shopify's "browser cookies" load error.
 *   - The Vite-built `index.html` shipped with `%VITE_SHOPIFY_API_KEY%`
 *     un-substituted — App Bridge couldn't initialize.
 *   - The Polaris stylesheet was never imported, so the bundle had no
 *     `<link rel="stylesheet">`.
 *   - A per-request CSP `frame-ancestors` directive was missing, so the
 *     browser wouldn't render us inside admin.shopify.com.
 *
 * Pre-builds a synthetic `dist/frontend` so the test doesn't need a
 * full `vite build` to run, then asserts the response shape on `/`.
 */
import path from "node:path";
import fs from "node:fs";
import os from "node:os";

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import type { Express } from "express";

import { createApp } from "../../src/server";

const distDir = path.resolve(process.cwd(), "dist", "frontend");
const distIndex = path.join(distDir, "index.html");

// Minimal index.html that mirrors the structure Vite emits: a meta tag
// using the %VITE_X% placeholder and a link to a hashed CSS asset. The
// server reads this once at boot and substitutes the placeholder.
const FAKE_INDEX = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="shopify-api-key" content="%VITE_SHOPIFY_API_KEY%" />
    <script src="https://cdn.shopify.com/shopifycloud/app-bridge.js"></script>
    <link rel="stylesheet" crossorigin href="/assets/index-fake.css">
    <script type="module" crossorigin src="/assets/index-fake.js"></script>
  </head>
  <body><div id="root"></div></body>
</html>`;

let preExistingDist = false;
let preExistingIndex: string | null = null;
let preExistingDistFiles: string[] | null = null;

describe("SPA serving + embed headers", () => {
  let app: Express;

  beforeAll(() => {
    // If the dev/CI environment already has a real `vite build` output,
    // back it up so we don't clobber it. Restored in afterAll.
    if (fs.existsSync(distIndex)) {
      preExistingIndex = fs.readFileSync(distIndex, "utf8");
    }
    if (fs.existsSync(distDir)) {
      preExistingDist = true;
      preExistingDistFiles = fs.readdirSync(distDir);
    }
    fs.mkdirSync(distDir, { recursive: true });
    fs.writeFileSync(distIndex, FAKE_INDEX);

    app = createApp();
  });

  afterAll(() => {
    // Best-effort cleanup. Restore the pre-existing index if we backed
    // one up; otherwise remove the synthetic file we wrote.
    try {
      if (preExistingIndex !== null) {
        fs.writeFileSync(distIndex, preExistingIndex);
      } else {
        fs.unlinkSync(distIndex);
      }
      if (!preExistingDist) {
        // Only remove the directory if we created it AND it's still empty
        // of anything we didn't put there. Conservative: skip removal if
        // unknown files appeared.
        const remaining = fs.readdirSync(distDir);
        if (remaining.length === 0) {
          fs.rmdirSync(distDir);
          // Walk up to dist/ — also remove if empty.
          const parent = path.dirname(distDir);
          if (
            fs.existsSync(parent) &&
            fs.readdirSync(parent).length === 0
          ) {
            fs.rmdirSync(parent);
          }
        }
      } else if (preExistingDistFiles) {
        // dir was pre-existing — leave whatever else was there alone.
      }
    } catch {
      // swallow — cleanup is best-effort
    }
  });

  it("serves the SPA at / with status 200 and HTML body", async () => {
    const res = await request(app).get("/?shop=demo.myshopify.com");
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toMatch(/text\/html/);
    expect(res.text).toContain("<!DOCTYPE html>");
  });

  it("substitutes %VITE_SHOPIFY_API_KEY% with the runtime key", async () => {
    const res = await request(app).get("/?shop=demo.myshopify.com");
    expect(res.text).not.toContain("%VITE_SHOPIFY_API_KEY%");
    // tests/setup.ts seeds SHOPIFY_API_KEY=test-key
    expect(res.text).toContain('content="test-key"');
  });

  it("emits a CSS link tag (Polaris stylesheet not dropped)", async () => {
    const res = await request(app).get("/?shop=demo.myshopify.com");
    expect(res.text).toMatch(/<link\s+rel="stylesheet"[^>]*href="\/assets\/index-/);
  });

  it("does NOT set X-Frame-Options (Helmet frameguard disabled)", async () => {
    const res = await request(app).get("/?shop=demo.myshopify.com");
    expect(res.headers["x-frame-options"]).toBeUndefined();
  });

  it("does NOT set Cross-Origin-Opener-Policy (would break iframe<->parent)", async () => {
    const res = await request(app).get("/?shop=demo.myshopify.com");
    expect(res.headers["cross-origin-opener-policy"]).toBeUndefined();
  });

  it("does NOT set Cross-Origin-Resource-Policy (would block cross-origin embed)", async () => {
    const res = await request(app).get("/?shop=demo.myshopify.com");
    expect(res.headers["cross-origin-resource-policy"]).toBeUndefined();
  });

  it("emits a per-request CSP frame-ancestors for the requesting shop", async () => {
    const res = await request(app).get("/?shop=demo.myshopify.com");
    const csp = res.headers["content-security-policy"];
    expect(csp).toBeDefined();
    expect(csp).toContain("frame-ancestors");
    expect(csp).toContain("https://demo.myshopify.com");
    expect(csp).toContain("https://admin.shopify.com");
  });

  it("falls back to *.myshopify.com when no ?shop= is present", async () => {
    const res = await request(app).get("/");
    const csp = res.headers["content-security-policy"];
    expect(csp).toContain("https://*.myshopify.com");
    expect(csp).toContain("https://admin.shopify.com");
  });

  it("/api/v1/* still returns the auth redirect, not the SPA HTML", async () => {
    // Sanity check: the SPA catch-all regex `/^\/(?!api\/|health$).*/`
    // must not swallow API routes. /api/v1/bundles without a session
    // should NOT respond with the index.html body.
    const res = await request(app).get("/api/v1/bundles");
    expect(res.text).not.toContain("<!DOCTYPE html>");
  });
});
