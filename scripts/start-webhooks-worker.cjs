#!/usr/bin/env node
process.stdout.write("[start-webhooks-worker] script entered\n");
try {
  require(require.resolve("tsx/cli"));
  require("../src/jobs/webhooksWorker.ts");
} catch (err) {
  process.stderr.write("[start-webhooks-worker] FATAL: " + (err && err.stack ? err.stack : err) + "\n");
  process.exit(1);
}
