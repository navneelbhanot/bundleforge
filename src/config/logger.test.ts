import { Writable } from "node:stream";

import { describe, it, expect, beforeAll } from "vitest";
import pino from "pino";

beforeAll(() => {
  // env.LOG_LEVEL etc. aren't read by these tests because we build local
  // pino instances against a memory sink. We still need a valid env so that
  // src/config/logger can import without throwing — even though we don't
  // exercise its singleton.
  process.env.SHOPIFY_API_KEY ??= "k";
  process.env.SHOPIFY_API_SECRET ??= "s";
  process.env.SHOPIFY_SCOPES ??= "read_products";
  process.env.SHOPIFY_APP_URL ??= "https://example.com";
  process.env.DATABASE_URL ??= "postgres://u:p@h:5432/db";
  process.env.REDIS_URL ??= "redis://h:6379";
  process.env.ENCRYPTION_KEY ??= "a".repeat(64);
});

interface Captured {
  lines: string[];
  parsed: Array<Record<string, unknown>>;
}

function capture(): { sink: Writable; out: Captured } {
  const out: Captured = { lines: [], parsed: [] };
  const sink = new Writable({
    write(chunk, _enc, cb): void {
      const text = chunk.toString("utf8");
      for (const line of text.split("\n")) {
        if (!line.trim()) continue;
        out.lines.push(line);
        try {
          out.parsed.push(JSON.parse(line));
        } catch {
          /* pretty-printed lines are not JSON; ignore */
        }
      }
      cb();
    },
  });
  return { sink, out };
}

describe("logger", () => {
  it("imports the singleton without throwing", async () => {
    const mod = await import("./logger");
    expect(mod.logger).toBeDefined();
    expect(typeof mod.logger.info).toBe("function");
  });

  it("emits info but not debug when level=info", () => {
    const { sink, out } = capture();
    const log = pino(
      { level: "info", base: { service: "bundleforge", version: "0.0.1" } },
      sink,
    );
    log.info("hello");
    log.debug("world");
    expect(out.parsed).toHaveLength(1);
    expect(out.parsed[0].msg).toBe("hello");
  });

  it("emits debug when level=debug", () => {
    const { sink, out } = capture();
    const log = pino(
      { level: "debug", base: { service: "bundleforge", version: "0.0.1" } },
      sink,
    );
    log.debug("dbg");
    expect(out.parsed).toHaveLength(1);
    expect(out.parsed[0].msg).toBe("dbg");
  });

  it("includes service, version, level, and time in every line", () => {
    const { sink, out } = capture();
    const log = pino(
      {
        level: "info",
        base: { service: "bundleforge", version: "1.2.3" },
        timestamp: pino.stdTimeFunctions.isoTime,
      },
      sink,
    );
    log.info("hi");
    const line = out.parsed[0];
    expect(line.service).toBe("bundleforge");
    expect(line.version).toBe("1.2.3");
    expect(line.level).toBe(30); // pino numeric level for info
    expect(typeof line.time).toBe("string");
    expect(line.msg).toBe("hi");
  });

  it("child(bindings) attaches bindings to subsequent lines", () => {
    const { sink, out } = capture();
    const log = pino({ level: "info", base: { service: "bundleforge" } }, sink);
    const child = log.child({ module: "bundles", bundleId: "b-1" });
    child.info("created");
    expect(out.parsed[0].module).toBe("bundles");
    expect(out.parsed[0].bundleId).toBe("b-1");
  });
});
