#!/usr/bin/env node
process.stdout.write("[start-worker] script entered\n");
try {
  require(require.resolve("tsx/cli"));
  require("../src/jobs/worker.ts");
} catch (err) {
  process.stderr.write("[start-worker] FATAL: " + (err && err.stack ? err.stack : err) + "\n");
  process.exit(1);
}
