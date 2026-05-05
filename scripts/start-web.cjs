#!/usr/bin/env node
// Verbose entrypoint shim. Prints exactly which step we reach so a silent
// container exit on Railway / Fly / etc. is impossible.
process.stdout.write("[start-web] script entered\n");
process.stdout.write("[start-web] node " + process.version + " on " + process.platform + "\n");
process.stdout.write("[start-web] PORT=" + (process.env.PORT || "(unset)") + "\n");
process.stdout.write("[start-web] NODE_ENV=" + (process.env.NODE_ENV || "(unset)") + "\n");

// Required env vars whose absence causes a synchronous module-load throw.
// Print presence (not values) so a missing var is visible without leaking secrets.
const REQUIRED = [
  "DATABASE_URL",
  "REDIS_URL",
  "SHOPIFY_API_KEY",
  "SHOPIFY_API_SECRET",
  "SHOPIFY_APP_URL",
  "ENCRYPTION_KEY",
];
for (const k of REQUIRED) {
  process.stdout.write(
    "[start-web] " + k + "=" + (process.env[k] ? "set(" + process.env[k].length + " chars)" : "MISSING") + "\n",
  );
}

// Locate tsx. If it's not installed we want to know loudly.
let tsxPath;
try {
  tsxPath = require.resolve("tsx/cli");
  process.stdout.write("[start-web] tsx resolved at " + tsxPath + "\n");
} catch (err) {
  process.stderr.write("[start-web] FATAL: tsx is not installed. Build pruned devDeps?\n");
  process.stderr.write(String(err) + "\n");
  process.exit(1);
}

// Catch anything that escapes the entrypoint.
process.on("uncaughtException", (err) => {
  process.stderr.write("[start-web] uncaughtException: " + (err && err.stack ? err.stack : err) + "\n");
});
process.on("unhandledRejection", (err) => {
  process.stderr.write("[start-web] unhandledRejection: " + err + "\n");
});

// Hand off to tsx in the same process so signal handling (SIGTERM on
// container shutdown) reaches the server cleanly.
process.stdout.write("[start-web] handing off to tsx → src/server/index.ts\n");
require(tsxPath);
require("../src/server/index.ts");
