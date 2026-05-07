import { describe, it, expect, vi } from "vitest";

import {
  currentMonthBundleOrderCount,
  isOverOrderCap,
  startOfMonthUtc,
  type OrderCapPrisma,
} from "./orderCap";

function buildPrisma(rows: Array<{ shopifyOrderId: bigint }>): {
  prisma: OrderCapPrisma;
  findMany: ReturnType<typeof vi.fn>;
} {
  const findMany = vi.fn().mockResolvedValue(rows);
  const prisma: OrderCapPrisma = {
    bundleOrder: { findMany },
  };
  return { prisma, findMany };
}

describe("startOfMonthUtc", () => {
  it("returns 1st-of-month at 00:00:00 UTC", () => {
    const result = startOfMonthUtc(new Date("2026-05-07T13:42:11.123Z"));
    expect(result.toISOString()).toBe("2026-05-01T00:00:00.000Z");
  });

  it("does not drift across DST or local-tz boundaries", () => {
    // Caller's local tz is irrelevant; we only honour UTC.
    const result = startOfMonthUtc(new Date("2026-03-08T05:30:00.000Z"));
    expect(result.toISOString()).toBe("2026-03-01T00:00:00.000Z");
  });

  it("handles January correctly", () => {
    const result = startOfMonthUtc(new Date("2026-01-15T00:00:00.000Z"));
    expect(result.toISOString()).toBe("2026-01-01T00:00:00.000Z");
  });
});

describe("currentMonthBundleOrderCount", () => {
  const SHOP_ID = "shop-uuid-1";
  const NOW = new Date("2026-05-07T13:42:11.123Z");

  it("returns 0 when the shop has no orders this month", async () => {
    const { prisma, findMany } = buildPrisma([]);
    const count = await currentMonthBundleOrderCount(prisma, SHOP_ID, NOW);
    expect(count).toBe(0);
    expect(findMany).toHaveBeenCalledWith({
      where: {
        shopId: SHOP_ID,
        createdAt: { gte: new Date("2026-05-01T00:00:00.000Z") },
      },
      distinct: ["shopifyOrderId"],
      select: { shopifyOrderId: true },
    });
  });

  it("returns the row count when distinct rows are returned", async () => {
    const { prisma } = buildPrisma([
      { shopifyOrderId: BigInt(1) },
      { shopifyOrderId: BigInt(2) },
      { shopifyOrderId: BigInt(3) },
    ]);
    const count = await currentMonthBundleOrderCount(prisma, SHOP_ID, NOW);
    expect(count).toBe(3);
  });

  it("scopes the query to the current calendar month boundary", async () => {
    const { prisma, findMany } = buildPrisma([]);
    await currentMonthBundleOrderCount(
      prisma,
      SHOP_ID,
      new Date("2026-12-31T23:59:59.999Z"),
    );
    expect(findMany.mock.calls[0][0].where.createdAt.gte.toISOString()).toBe(
      "2026-12-01T00:00:00.000Z",
    );
  });
});

describe("isOverOrderCap", () => {
  const SHOP_ID = "shop-uuid-1";
  const NOW = new Date("2026-05-07T13:42:11.123Z");

  it("returns over=false on Growth without hitting the database", async () => {
    const { prisma, findMany } = buildPrisma([]);
    const status = await isOverOrderCap(
      prisma,
      { id: SHOP_ID, planName: "growth" },
      NOW,
    );
    expect(status).toEqual({
      over: false,
      cap: null,
      count: 0,
      plan: "growth",
    });
    expect(findMany).not.toHaveBeenCalled();
  });

  it("returns over=false on Pro without hitting the database", async () => {
    const { prisma, findMany } = buildPrisma([]);
    const status = await isOverOrderCap(
      prisma,
      { id: SHOP_ID, planName: "pro" },
      NOW,
    );
    expect(status.over).toBe(false);
    expect(status.cap).toBeNull();
    expect(findMany).not.toHaveBeenCalled();
  });

  it("returns over=false on Enterprise without hitting the database", async () => {
    const { prisma, findMany } = buildPrisma([]);
    const status = await isOverOrderCap(
      prisma,
      { id: SHOP_ID, planName: "enterprise" },
      NOW,
    );
    expect(status.over).toBe(false);
    expect(findMany).not.toHaveBeenCalled();
  });

  it("returns over=false on Starter at 99 distinct orders", async () => {
    const rows = Array.from({ length: 99 }, (_, i) => ({
      shopifyOrderId: BigInt(i + 1),
    }));
    const { prisma } = buildPrisma(rows);
    const status = await isOverOrderCap(
      prisma,
      { id: SHOP_ID, planName: "starter" },
      NOW,
    );
    expect(status).toEqual({
      over: false,
      cap: 100,
      count: 99,
      plan: "starter",
    });
  });

  it("returns over=true on Starter at exactly 100 distinct orders", async () => {
    const rows = Array.from({ length: 100 }, (_, i) => ({
      shopifyOrderId: BigInt(i + 1),
    }));
    const { prisma } = buildPrisma(rows);
    const status = await isOverOrderCap(
      prisma,
      { id: SHOP_ID, planName: "starter" },
      NOW,
    );
    expect(status.over).toBe(true);
    expect(status.count).toBe(100);
    expect(status.cap).toBe(100);
  });

  it("returns over=true on Starter past 100 distinct orders", async () => {
    const rows = Array.from({ length: 137 }, (_, i) => ({
      shopifyOrderId: BigInt(i + 1),
    }));
    const { prisma } = buildPrisma(rows);
    const status = await isOverOrderCap(
      prisma,
      { id: SHOP_ID, planName: "starter" },
      NOW,
    );
    expect(status.over).toBe(true);
    expect(status.count).toBe(137);
  });

  it("treats unknown plan names as starter (the default)", async () => {
    const { prisma } = buildPrisma([
      { shopifyOrderId: BigInt(1) },
      { shopifyOrderId: BigInt(2) },
    ]);
    const status = await isOverOrderCap(
      prisma,
      { id: SHOP_ID, planName: "made-up" },
      NOW,
    );
    expect(status.plan).toBe("starter");
    expect(status.cap).toBe(100);
    expect(status.count).toBe(2);
    expect(status.over).toBe(false);
  });
});
