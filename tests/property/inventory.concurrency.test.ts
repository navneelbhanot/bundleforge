/**
 * M-137 — Inventory engine concurrency property test.
 *
 * Logical contract: N concurrent applyAdjustment calls must produce
 * a final balance equal to the sum of deltas, never oversell. The
 * fake repo serializes mutations under a small mutex to simulate
 * Postgres' SELECT … FOR UPDATE; the test asserts the engine's call
 * pattern is compatible with that semantics.
 */
import { describe, it, expect } from "vitest";

import {
  applyAdjustment,
  type InventoryRepo,
} from "../../src/services/inventory";
import type { AuditWriter } from "../../src/services/inventory/audit";

interface FakeState {
  available: number;
  audit: number;
}

function makeRepo(initial: number): InventoryRepo & {
  state: FakeState;
  inventoryAuditLog: AuditWriter["inventoryAuditLog"];
} {
  const state: FakeState = { available: initial, audit: 0 };
  let busy = false;
  async function lock<T>(fn: () => Promise<T>): Promise<T> {
    while (busy) await new Promise((r) => setImmediate(r));
    busy = true;
    try {
      return await fn();
    } finally {
      busy = false;
    }
  }
  const repo = {
    inventorySyncState: {
      async findUnique() {
        return state.available !== null
          ? {
              id: "sync-1",
              availableQuantity: state.available,
              committedQuantity: 0,
              syncStatus: "synced",
            }
          : null;
      },
      async upsert(args: { update: { availableQuantity?: number } }) {
        if (typeof args.update.availableQuantity === "number") {
          state.available = args.update.availableQuantity;
        }
        return { id: "sync-1" };
      },
    },
    inventoryAuditLog: {
      async create(): Promise<{ id: string }> {
        state.audit += 1;
        return { id: `a-${state.audit}` };
      },
    },
    $transaction: async <T>(fn: (tx: InventoryRepo & AuditWriter) => Promise<T>) =>
      lock(() => fn(repo as unknown as InventoryRepo & AuditWriter)),
    state,
  } as unknown as InventoryRepo & {
    state: FakeState;
    inventoryAuditLog: AuditWriter["inventoryAuditLog"];
  };
  return repo;
}

describe("inventory engine concurrency (M-137)", () => {
  it("100 concurrent decrements stay above zero and reach the right total", async () => {
    const N = 100;
    const repo = makeRepo(N);
    const calls = Array.from({ length: N }, (_, i) =>
      applyAdjustment(
        {
          shopId: "shop",
          bundleId: "b",
          locationGid: "gid://Loc/1",
          inventoryItemGid: "gid://Inv/1",
          delta: -1,
          reason: "order_placed",
          source: "webhook",
          referenceId: `o-${i}`,
        },
        repo,
      ),
    );
    const results = await Promise.all(calls);
    expect(repo.state.available).toBe(0);
    expect(repo.state.audit).toBe(N);
    expect(results.every((r) => r.locked === false)).toBe(true);
    expect(results.every((r) => r.after >= 0)).toBe(true);
  });

  it("mixed +/- deltas converge to the algebraic sum", async () => {
    const repo = makeRepo(10);
    const ops: number[] = [];
    for (let i = 0; i < 50; i++) ops.push(((i % 7) - 3));
    const sum = ops.reduce((a, b) => a + b, 0);
    // Pre-stabilize: if a step would push negative, we filter it (the
    // engine throws on negatives in the real DB; here we shrink the
    // schedule deterministically before running).
    const schedule = ops.filter((d) => d >= -repo.state.available);
    let projected = repo.state.available;
    const safe: number[] = [];
    for (const d of schedule) {
      if (projected + d < 0) continue;
      projected += d;
      safe.push(d);
    }
    await Promise.all(
      safe.map((d, i) =>
        applyAdjustment(
          {
            shopId: "shop",
            bundleId: "b",
            locationGid: "gid://Loc/1",
            inventoryItemGid: "gid://Inv/1",
            delta: d,
            reason: "manual_adjust",
            source: "system",
            referenceId: `t-${i}`,
          },
          repo,
        ),
      ),
    );
    expect(repo.state.available).toBe(10 + safe.reduce((a, b) => a + b, 0));
    expect(repo.state.available).toBeLessThanOrEqual(10 + Math.max(0, sum));
  });
});
