import { describe, it, expect, beforeAll } from "vitest";

import {
  SLOW_QUERY_MS_THRESHOLD,
  shouldLogSlowQuery,
} from "./database";

beforeAll(() => {
  process.env.SHOPIFY_API_KEY ??= "k";
  process.env.SHOPIFY_API_SECRET ??= "s";
  process.env.SHOPIFY_SCOPES ??= "read_products";
  process.env.SHOPIFY_APP_URL ??= "https://example.com";
  process.env.DATABASE_URL ??= "postgres://u:p@h:5432/db";
  process.env.REDIS_URL ??= "redis://h:6379";
  process.env.ENCRYPTION_KEY ??= "a".repeat(64);
});

describe("database module", () => {
  it("imports without throwing", async () => {
    const mod = await import("./database");
    expect(mod.prisma).toBeDefined();
    expect(typeof mod.connectDatabase).toBe("function");
    expect(typeof mod.disconnectDatabase).toBe("function");
  });
});

describe("shouldLogSlowQuery", () => {
  it("returns false when duration is at the threshold", () => {
    expect(shouldLogSlowQuery(SLOW_QUERY_MS_THRESHOLD)).toBe(false);
  });

  it("returns false when duration is below the threshold", () => {
    expect(shouldLogSlowQuery(SLOW_QUERY_MS_THRESHOLD - 1)).toBe(false);
    expect(shouldLogSlowQuery(0)).toBe(false);
  });

  it("returns true when duration is above the threshold", () => {
    expect(shouldLogSlowQuery(SLOW_QUERY_MS_THRESHOLD + 1)).toBe(true);
    expect(shouldLogSlowQuery(10_000)).toBe(true);
  });
});
