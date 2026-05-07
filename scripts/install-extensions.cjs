#!/usr/bin/env node
/**
 * Install per-extension dependencies after the root install.
 *
 * Shopify Functions live in `extensions/<name>` with their own
 * package.json (they need `@shopify/shopify_function` for the wasm
 * trampoline). The root project is not a workspace, so a top-level
 * `npm install` does NOT recurse — without this script the
 * extension `node_modules/` directories stay missing and
 * `shopify app deploy` aborts with:
 *   Could not find the Shopify Functions JavaScript library.
 *
 * Run as `postinstall` in the root package.json so a single
 * `npm install` from the repo root (or any tooling that runs it,
 * e.g. CI / `git pull && npm install`) leaves both extensions
 * ready to build.
 *
 * Behaviour:
 *  - Idempotent: skips an extension whose node_modules already
 *    contains @shopify/shopify_function.
 *  - Best-effort: failures are warned (not fatal) so a broken
 *    extension never blocks the parent install.
 *  - Honours CI / lockfiles: uses `npm ci` when a lockfile is
 *    present, falls back to `npm install` otherwise.
 */
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const EXTENSIONS = ["cart-transform", "checkout-validation"];
const ROOT = path.resolve(__dirname, "..");

function hasShopifyFunctionLibrary(extDir) {
  return fs.existsSync(
    path.join(extDir, "node_modules", "@shopify", "shopify_function", "package.json"),
  );
}

function installExtension(name) {
  const extDir = path.join(ROOT, "extensions", name);
  const pkgJson = path.join(extDir, "package.json");
  if (!fs.existsSync(pkgJson)) return;

  if (hasShopifyFunctionLibrary(extDir)) {
    console.log(`[install-extensions] ${name}: already installed, skipping.`);
    return;
  }

  const lockFile = path.join(extDir, "package-lock.json");
  const useCi = fs.existsSync(lockFile);
  const cmd = "npm";
  const args = useCi ? ["ci", "--silent"] : ["install", "--silent"];
  console.log(`[install-extensions] ${name}: running ${cmd} ${args.join(" ")}`);
  const result = spawnSync(cmd, args, {
    cwd: extDir,
    stdio: "inherit",
    env: { ...process.env, npm_config_audit: "false", npm_config_fund: "false" },
  });
  if (result.status !== 0) {
    console.warn(
      `[install-extensions] ${name}: install exited with ${result.status} — continuing.`,
    );
  }
}

for (const ext of EXTENSIONS) {
  try {
    installExtension(ext);
  } catch (err) {
    console.warn(`[install-extensions] ${ext}: ${err.message}`);
  }
}
