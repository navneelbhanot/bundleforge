import { describe, it, expect, vi } from "vitest";

import {
  applyAdjustment,
  recomputeBundleStock,
  type InventoryRepo,
} from "./index";
import type { AuditWriter } from "./audit";

interface FakeRepoState {
  before: number | null; // null = no row
}

interface FakeRepo extends InventoryRepo {
  inventoryAuditLog: AuditWriter["inventoryAuditLog"];
  spy: {
    upsert: ReturnType<typeof vi.fn>;
    auditCreate: ReturnType<typeof vi.fn>;
  };
}

function fakeRepo(state: FakeRepoState): FakeRepo {
  const upsert = vi.fn(
    async (args: { update: { availableQuantity?: number } }) => ({
      id: "sync-1",
      ...args,
    }),
  );
  const auditCreate = vi.fn(async () => ({ id: "audit-1" }));
  const repo = {
    inventorySyncState: {
      findUnique: vi.fn(async () =>
        state.before === null
          ? null
          : {
              id: "sync-1",
              availableQuantity: state.before,
              committedQuantity: 0,
              syncStatus: "synced",
            },
      ),
      upsert,
    },
    inventoryAuditLog: { create: auditCreate },
    $transaction: async <T>(fn: (tx: InventoryRepo & AuditWriter) => Promise<T>) =>
      fn(repo as unknown as InventoryRepo & AuditWriter),
    spy: { upsert, auditCreate },
  } as unknown as FakeRepo;
  return repo;
}

describe("recomputeBundleStock", () => {
  it("returns 0 for empty components", () => {
    expect(recomputeBundleStock([])).toBe(0);
  });

  it("returns the limiting component's quotient", () => {
    expect(
      recomputeBundleStock([
        { availableUnits: 10, perBundle: 1 },
        { availableUnits: 8, perBundle: 2 }, // 4
        { availableUnits: 9, perBundle: 3 }, // 3 ← limiter
      ]),
    ).toBe(3);
  });

  it("ignores non-positive perBundle", () => {
    expect(
      recomputeBundleStock([{ availableUnits: 10, perBundle: 0 }]),
    ).toBe(0);
  });
});

describe("applyAdjustment — happy path", () => {
  it("creates state row + audit row when no row exists yet", async () => {
    const repo = fakeRepo({ before: null });
    const result = await applyAdjustment(
      {
        shopId: "shop",
        bundleId: "b-1",
        locationGid: "gid://Location/1",
        inventoryItemGid: "gid://Inv/1",
        delta: 5,
        reason: "manual_adjust",
        source: "admin",
      },
      repo,
    );
    expect(result).toEqual({ before: 0, after: 5, locked: false });
    expect(repo.spy.upsert).toHaveBeenCalledTimes(1);
    expect(repo.spy.auditCreate).toHaveBeenCalledTimes(1);
    const auditArgs = repo.spy.auditCreate.mock.calls[0][0];
    expect(auditArgs.data.action).toBe("adjust");
    expect(auditArgs.data.quantityBefore).toBe(0);
    expect(auditArgs.data.quantityAfter).toBe(5);
    expect(auditArgs.data.quantityDelta).toBe(5);
  });

  it("decrements existing stock cleanly", async () => {
    const repo = fakeRepo({ before: 10 });
    const result = await applyAdjustment(
      {
        shopId: "shop",
        bundleId: "b-1",
        locationGid: "gid://Location/1",
        inventoryItemGid: "gid://Inv/1",
        delta: -3,
        reason: "order_placed",
        source: "webhook",
        referenceId: "order-42",
      },
      repo,
    );
    expect(result.before).toBe(10);
    expect(result.after).toBe(7);
  });
});

describe("applyAdjustment — guardrails", () => {
  it("rejects an adjustment that pushes stock negative", async () => {
    const repo = fakeRepo({ before: 1 });
    await expect(
      applyAdjustment(
        {
          shopId: "shop",
          bundleId: "b-1",
          locationGid: "gid://Location/1",
          inventoryItemGid: "gid://Inv/1",
          delta: -5,
          reason: "order_placed",
          source: "webhook",
        },
        repo,
      ),
    ).rejects.toThrow(/negative/);
    expect(repo.spy.auditCreate).not.toHaveBeenCalled();
  });
});

describe("applyAdjustment — safety lock (M-074)", () => {
  it("records audit + sets locked but does NOT change availableQuantity", async () => {
    const repo = fakeRepo({ before: 10 });
    const result = await applyAdjustment(
      {
        shopId: "shop",
        bundleId: "b-1",
        locationGid: "gid://Location/1",
        inventoryItemGid: "gid://Inv/1",
        delta: -4,
        reason: "manual_adjust",
        source: "admin",
        shopSafetyLockOn: true,
      },
      repo,
    );
    expect(result.locked).toBe(true);
    const auditArgs = repo.spy.auditCreate.mock.calls[0][0];
    expect(auditArgs.data.action).toBe("safety_lock");
    expect(auditArgs.data.quantityBefore).toBe(10);
    expect(auditArgs.data.quantityAfter).toBe(6);
    // upsert called but not with availableQuantity in the update branch
    const upsertArgs = repo.spy.upsert.mock.calls[0][0];
    expect(upsertArgs.update.syncStatus).toBe("locked");
    expect(upsertArgs.update.availableQuantity).toBeUndefined();
  });

  it("safety_lock with delta=0 still commits (no-op)", async () => {
    const repo = fakeRepo({ before: 5 });
    const result = await applyAdjustment(
      {
        shopId: "shop",
        bundleId: "b-1",
        locationGid: "gid://Location/1",
        inventoryItemGid: "gid://Inv/1",
        delta: 0,
        reason: "sync",
        source: "system",
        shopSafetyLockOn: true,
      },
      repo,
    );
    expect(result.locked).toBe(false);
  });
});
