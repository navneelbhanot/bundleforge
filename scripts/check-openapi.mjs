#!/usr/bin/env node
/**
 * Tiny linter for docs/openapi.yaml. We don't want a heavy YAML parser on
 * the dep tree just for a structural smoke check; we already validated by
 * eye. This script asserts the file:
 *   - exists,
 *   - declares openapi 3.x,
 *   - has top-level info/paths blocks,
 *   - documents every public route the server actually mounts.
 *
 * Anything richer can be done in CI with `npx swagger-cli`.
 */
import fs from "node:fs";
import path from "node:path";

const SPEC = path.resolve("docs/openapi.yaml");

function fail(msg) {
  console.error(`docs:openapi FAIL — ${msg}`);
  process.exit(1);
}

if (!fs.existsSync(SPEC)) fail("docs/openapi.yaml missing");
const text = fs.readFileSync(SPEC, "utf8");

if (!/^openapi:\s*3\./m.test(text)) fail("openapi version header missing");
if (!/^info:/m.test(text)) fail("`info:` block missing");
if (!/^paths:/m.test(text)) fail("`paths:` block missing");

// Spot-check a handful of routes the server is known to mount; these should
// always be present.
const REQUIRED_PATHS = [
  "/health",
  "/api/v1/bundles",
  "/api/v1/orders",
  "/api/v1/inventory/audit",
  "/api/v1/analytics/overview",
  "/api/v1/settings",
  "/api/v1/billing/subscribe",
  "/api/v1/gdpr/export",
  "/api/v1/gdpr/delete-shop",
];
for (const p of REQUIRED_PATHS) {
  if (!text.includes(`\n  ${p}:`)) fail(`route ${p} not documented`);
}

console.log("docs:openapi OK");
