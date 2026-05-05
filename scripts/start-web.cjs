#!/usr/bin/env node
/* eslint-disable no-console */
// Single-process entrypoint: migrations + server. Inlining both eliminates
// shell-chain ambiguity that was hiding boot failures on Railway.
process.stdout.write("[start-web] script entered\n");
process.stdout.write("[start-web] node " + process.version + " on " + process.platform + "\n");
process.stdout.write("[start-web] cwd=" + process.cwd() + "\n");
process.stdout.write("[start-web] PORT=" + (process.env.PORT || "(unset)") + "\n");
process.stdout.write("[start-web] NODE_ENV=" + (process.env.NODE_ENV || "(unset)") + "\n");

// Print presence (not values) of each required env var.
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

// Catch anything that escapes downstream code.
process.on("uncaughtException", (err) => {
  process.stderr.write("[start-web] uncaughtException: " + (err && err.stack ? err.stack : err) + "\n");
});
process.on("unhandledRejection", (err) => {
  process.stderr.write("[start-web] unhandledRejection: " + err + "\n");
});

const { spawnSync } = require("node:child_process");

// 1) Run prisma migrate deploy synchronously. inheritStdio so we see output
//    in real time. Bail with a non-zero exit if it fails.
process.stdout.write("[start-web] running prisma migrate deploy…\n");
const migrate = spawnSync("npx", ["prisma", "migrate", "deploy"], { stdio: "inherit" });
if (migrate.status !== 0) {
  process.stderr.write("[start-web] FATAL: prisma migrate deploy exited " + migrate.status + "\n");
  process.exit(migrate.status || 1);
}
process.stdout.write("[start-web] migrations OK\n");

// 2) Locate tsx and load the server entrypoint in-process.
let tsxPath;
try {
  tsxPath = require.resolve("tsx/cli");
  process.stdout.write("[start-web] tsx resolved at " + tsxPath + "\n");
} catch (err) {
  process.stderr.write("[start-web] FATAL: tsx is not installed. Build pruned devDeps?\n");
  process.stderr.write(String(err) + "\n");
  process.exit(1);
}

process.stdout.write("[start-web] handing off to tsx → src/server/index.ts\n");
require(tsxPath);
require("../src/server/index.ts");
