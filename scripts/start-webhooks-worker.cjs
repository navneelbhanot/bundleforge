#!/usr/bin/env node
/* eslint-disable no-console */
process.stdout.write("[start-webhooks-worker] script entered\n");

let tsxPath;
try {
  tsxPath = require.resolve("tsx/cli");
} catch (err) {
  process.stderr.write("[start-webhooks-worker] FATAL: tsx is not installed.\n");
  process.stderr.write(String(err) + "\n");
  process.exit(1);
}

const { spawn } = require("node:child_process");
const child = spawn(process.execPath, [tsxPath, "src/jobs/webhooksWorker.ts"], {
  stdio: "inherit",
  env: process.env,
});
const forward = (sig) => () => child.kill(sig);
process.on("SIGTERM", forward("SIGTERM"));
process.on("SIGINT", forward("SIGINT"));
child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  else process.exit(code ?? 1);
});
