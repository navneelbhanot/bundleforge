import { describe, it, expect, vi } from "vitest";

import {
  maybeNotifyCapStatus,
  monthKey,
  type NotifyCapPrisma,
  type NotifyCapShop,
} from "./notifications";

function buildPrisma(rowsForCount: number, capturedSettings?: { value?: unknown }): NotifyCapPrisma {
  return {
    bundleOrder: {
      findMany: vi.fn().mockResolvedValue(
        Array.from({ length: rowsForCount }, (_, i) => ({
          shopifyOrderId: BigInt(i + 1),
        })),
      ),
    },
    shop: {
      update: vi.fn(async (args) => {
        if (capturedSettings) capturedSettings.value = args.data.settings;
        return { id: args.where.id };
      }),
    },
  };
}

function buildShop(overrides: Partial<NotifyCapShop> = {}): NotifyCapShop {
  return {
    id: "shop-uuid",
    name: "Demo Shop",
    email: "owner@demo.example",
    planName: "starter",
    settings: {},
    ...overrides,
  };
}

const NOW = new Date("2026-05-07T13:42:00.000Z");
const NOW_MONTH = "2026-05";

describe("monthKey", () => {
  it("returns YYYY-MM in UTC", () => {
    expect(monthKey(new Date("2026-05-07T23:59:59.999Z"))).toBe("2026-05");
    expect(monthKey(new Date("2026-01-01T00:00:00.000Z"))).toBe("2026-01");
    expect(monthKey(new Date("2026-12-31T23:59:59.999Z"))).toBe("2026-12");
  });
});

describe("maybeNotifyCapStatus", () => {
  it("noops on a paid plan (cap=null)", async () => {
    const prisma = buildPrisma(0);
    const send = vi.fn();
    const shop = buildShop({ planName: "growth" });
    const result = await maybeNotifyCapStatus(prisma, shop, {
      send,
      now: () => NOW,
    });
    expect(result).toEqual({ kind: "noop", reason: "paid_plan" });
    expect(send).not.toHaveBeenCalled();
    expect(prisma.shop.update).not.toHaveBeenCalled();
  });

  it("noops below the 80% threshold", async () => {
    const prisma = buildPrisma(50);
    const send = vi.fn();
    const result = await maybeNotifyCapStatus(prisma, buildShop(), {
      send,
      now: () => NOW,
    });
    expect(result).toEqual({ kind: "noop", reason: "below_threshold" });
    expect(send).not.toHaveBeenCalled();
  });

  it("sends warning at 80 and persists the sent month", async () => {
    const captured: { value?: unknown } = {};
    const prisma = buildPrisma(80, captured);
    const send = vi.fn().mockResolvedValue({ ok: true, id: "msg_warn" });
    const result = await maybeNotifyCapStatus(prisma, buildShop(), {
      send,
      now: () => NOW,
    });
    expect(result).toEqual({ kind: "warning_sent", messageId: "msg_warn" });
    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0][0].subject).toContain("80 of 100");
    expect(captured.value).toMatchObject({
      capNotifications: { warningSentMonth: NOW_MONTH },
    });
  });

  it("does not re-send warning if already sent this month", async () => {
    const prisma = buildPrisma(95);
    const send = vi.fn();
    const shop = buildShop({
      settings: { capNotifications: { warningSentMonth: NOW_MONTH } },
    });
    const result = await maybeNotifyCapStatus(prisma, shop, {
      send,
      now: () => NOW,
    });
    expect(result).toEqual({
      kind: "noop",
      reason: "warning_already_sent_this_month",
    });
    expect(send).not.toHaveBeenCalled();
    expect(prisma.shop.update).not.toHaveBeenCalled();
  });

  it("re-sends warning in a new month even if a previous month was already sent", async () => {
    const captured: { value?: unknown } = {};
    const prisma = buildPrisma(80, captured);
    const send = vi.fn().mockResolvedValue({ ok: true, id: "msg_warn" });
    const shop = buildShop({
      settings: { capNotifications: { warningSentMonth: "2026-04" } },
    });
    const result = await maybeNotifyCapStatus(prisma, shop, {
      send,
      now: () => NOW,
    });
    expect(result.kind).toBe("warning_sent");
    expect(captured.value).toMatchObject({
      capNotifications: {
        warningSentMonth: NOW_MONTH,
      },
    });
  });

  it("sends reached at 100 and persists the sent month", async () => {
    const captured: { value?: unknown } = {};
    const prisma = buildPrisma(100, captured);
    const send = vi.fn().mockResolvedValue({ ok: true, id: "msg_reached" });
    const result = await maybeNotifyCapStatus(prisma, buildShop(), {
      send,
      now: () => NOW,
    });
    expect(result).toEqual({ kind: "reached_sent", messageId: "msg_reached" });
    expect(send.mock.calls[0][0].subject).toContain("Starter limit");
    expect(captured.value).toMatchObject({
      capNotifications: { reachedSentMonth: NOW_MONTH },
    });
  });

  it("prefers reached over warning when both could fire (over=true takes priority)", async () => {
    const prisma = buildPrisma(110);
    const send = vi.fn().mockResolvedValue({ ok: true, id: "msg" });
    const result = await maybeNotifyCapStatus(prisma, buildShop(), {
      send,
      now: () => NOW,
    });
    expect(result.kind).toBe("reached_sent");
    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0][0].subject).toContain("Starter limit");
  });

  it("does not re-send reached if already sent this month", async () => {
    const prisma = buildPrisma(110);
    const send = vi.fn();
    const shop = buildShop({
      settings: { capNotifications: { reachedSentMonth: NOW_MONTH } },
    });
    const result = await maybeNotifyCapStatus(prisma, shop, {
      send,
      now: () => NOW,
    });
    expect(result).toEqual({
      kind: "noop",
      reason: "reached_already_sent_this_month",
    });
    expect(send).not.toHaveBeenCalled();
  });

  it("returns send_failed and does NOT persist when the mailer fails", async () => {
    const prisma = buildPrisma(80);
    const send = vi.fn().mockResolvedValue({ ok: false, error: "boom" });
    const result = await maybeNotifyCapStatus(prisma, buildShop(), {
      send,
      now: () => NOW,
    });
    expect(result).toEqual({
      kind: "send_failed",
      level: "warning",
      error: "boom",
    });
    expect(prisma.shop.update).not.toHaveBeenCalled();
  });

  it("preserves unrelated keys in shop.settings when persisting", async () => {
    const captured: { value?: unknown } = {};
    const prisma = buildPrisma(80, captured);
    const send = vi.fn().mockResolvedValue({ ok: true, id: "msg" });
    const shop = buildShop({
      settings: { safetyLock: true, foo: "bar" },
    });
    await maybeNotifyCapStatus(prisma, shop, { send, now: () => NOW });
    expect(captured.value).toMatchObject({
      safetyLock: true,
      foo: "bar",
      capNotifications: { warningSentMonth: NOW_MONTH },
    });
  });
});
