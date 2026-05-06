import { describe, it, expect, vi } from "vitest";

import {
  processExpiredBundles,
  type ScheduleSweepDeps,
} from "./scheduleSweep";

interface Row {
  id: string;
  shopId: string;
  status: string;
  endsAt: Date;
  scheduleSettings: Record<string, unknown> | null;
}

function makeDeps(rows: Row[]): ScheduleSweepDeps & {
  findMany: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
  append: ReturnType<typeof vi.fn>;
} {
  const findMany = vi.fn().mockResolvedValue(rows);
  const update = vi.fn().mockResolvedValue(undefined);
  const append = vi.fn().mockResolvedValue(undefined);
  return {
    client: { bundle: { findMany, update } } as unknown as ScheduleSweepDeps["client"],
    appendActivity: append,
    findMany,
    update,
    append,
  };
}

const NOW = new Date("2026-05-06T12:00:00Z");
const PAST = new Date("2026-05-05T00:00:00Z");

describe("processExpiredBundles (M-170b)", () => {
  it("returns zeros when no bundle has expired", async () => {
    const deps = makeDeps([]);
    const out = await processExpiredBundles(NOW, deps);
    expect(out).toEqual({ archived: 0, paused: 0, errors: 0 });
    expect(deps.update).not.toHaveBeenCalled();
  });

  it("'archive' endBehavior → status 'archived'", async () => {
    const deps = makeDeps([
      {
        id: "b-1",
        shopId: "s-1",
        status: "active",
        endsAt: PAST,
        scheduleSettings: { endBehavior: "archive" },
      },
    ]);
    const out = await processExpiredBundles(NOW, deps);
    expect(out.archived).toBe(1);
    expect(deps.update.mock.calls[0][0]).toEqual({
      where: { id: "b-1" },
      data: { status: "archived" },
    });
    expect(deps.append.mock.calls[0][0].action).toBe("auto_archived");
  });

  it("'pause' endBehavior → status 'draft'", async () => {
    const deps = makeDeps([
      {
        id: "b-2",
        shopId: "s-1",
        status: "active",
        endsAt: PAST,
        scheduleSettings: { endBehavior: "pause" },
      },
    ]);
    const out = await processExpiredBundles(NOW, deps);
    expect(out.paused).toBe(1);
    expect(deps.update.mock.calls[0][0]).toEqual({
      where: { id: "b-2" },
      data: { status: "draft" },
    });
    expect(deps.append.mock.calls[0][0].action).toBe("auto_paused");
  });

  it("default (no endBehavior) → archive", async () => {
    const deps = makeDeps([
      {
        id: "b-3",
        shopId: "s-1",
        status: "active",
        endsAt: PAST,
        scheduleSettings: {},
      },
    ]);
    const out = await processExpiredBundles(NOW, deps);
    expect(out.archived).toBe(1);
    expect(out.paused).toBe(0);
  });

  it("captures errors per row and continues processing", async () => {
    const deps = makeDeps([
      {
        id: "b-fail",
        shopId: "s-1",
        status: "active",
        endsAt: PAST,
        scheduleSettings: { endBehavior: "archive" },
      },
      {
        id: "b-ok",
        shopId: "s-1",
        status: "active",
        endsAt: PAST,
        scheduleSettings: { endBehavior: "archive" },
      },
    ]);
    deps.update
      .mockRejectedValueOnce(new Error("db down"))
      .mockResolvedValueOnce(undefined);
    const out = await processExpiredBundles(NOW, deps);
    expect(out.errors).toBe(1);
    expect(out.archived).toBe(1);
  });

  it("findMany throws → returns zeros", async () => {
    const findMany = vi.fn().mockRejectedValue(new Error("db down"));
    const deps: ScheduleSweepDeps = {
      client: {
        bundle: {
          findMany,
          update: vi.fn(),
        },
      } as unknown as ScheduleSweepDeps["client"],
      appendActivity: vi.fn(),
    };
    const out = await processExpiredBundles(NOW, deps);
    expect(out).toEqual({ archived: 0, paused: 0, errors: 0 });
  });
});
