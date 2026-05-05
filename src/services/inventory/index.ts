/**
 * Inventory engine (M-070..M-074).
 *
 * Every inventory mutation flows through `applyAdjustment`. It runs
 * inside `prisma.$transaction` so the audit log row and the
 * inventory_sync_state row land atomically. Per ADR-0003, this is the
 * core defense against the inventory-reset bugs that plague
 * competitors.
 *
 * Safety lock (M-074): when enabled at the shop level, adjustments
 * that would push stock to a different value are recorded in the audit
 * log with action="safety_lock" but NOT written to sync_state. A
 * merchant-approval workflow (UI later) can re-issue the adjustment
 * with shopSafetyLockOn=false to commit.
 */
import { prisma } from "../../config/database";
import { ConflictError } from "../../middleware/errorHandler";
import {
  writeAuditLog,
  type AuditWriter,
  type InventoryAction,
  type InventoryReason,
  type InventorySource,
} from "./audit";

export interface ApplyAdjustmentInput {
  shopId: string;
  bundleId: string;
  locationGid: string;
  inventoryItemGid: string;
  delta: number;
  reason: InventoryReason;
  source: InventorySource;
  referenceId?: string;
  metadata?: Record<string, unknown>;
  shopSafetyLockOn?: boolean;
  action?: InventoryAction;
}

export interface ApplyAdjustmentResult {
  before: number;
  after: number;
  locked: boolean;
}

export interface InventoryRepo {
  inventorySyncState: {
    findUnique(args: {
      where: {
        shopId_bundleId_locationGid: {
          shopId: string;
          bundleId: string;
          locationGid: string;
        };
      };
    }): Promise<{
      id: string;
      availableQuantity: number;
      committedQuantity: number;
      syncStatus: string;
    } | null>;
    upsert(args: {
      where: {
        shopId_bundleId_locationGid: {
          shopId: string;
          bundleId: string;
          locationGid: string;
        };
      };
      create: {
        shopId: string;
        bundleId: string;
        locationGid: string;
        shopifyInventoryItemGid: string;
        availableQuantity: number;
        lastSyncedAt: Date;
        syncStatus: string;
      };
      update: {
        availableQuantity?: number;
        lastSyncedAt?: Date;
        syncStatus?: string;
      };
    }): Promise<{ id: string }>;
  };
  $transaction<T>(fn: (tx: InventoryRepo & AuditWriter) => Promise<T>): Promise<T>;
}

/** Pure: max bundle multiples sellable from component stock levels. */
export function recomputeBundleStock(
  components: Array<{ availableUnits: number; perBundle: number }>,
): number {
  if (components.length === 0) return 0;
  let min = Infinity;
  for (const c of components) {
    if (c.perBundle <= 0) continue;
    const ratio = Math.floor(c.availableUnits / c.perBundle);
    if (ratio < min) min = ratio;
  }
  return Number.isFinite(min) ? Math.max(0, min) : 0;
}

export async function applyAdjustment(
  input: ApplyAdjustmentInput,
  repo: InventoryRepo = prisma as unknown as InventoryRepo,
): Promise<ApplyAdjustmentResult> {
  return repo.$transaction(async (tx) => {
    const existing = await tx.inventorySyncState.findUnique({
      where: {
        shopId_bundleId_locationGid: {
          shopId: input.shopId,
          bundleId: input.bundleId,
          locationGid: input.locationGid,
        },
      },
    });
    const before = existing?.availableQuantity ?? 0;
    const after = before + input.delta;
    if (after < 0) {
      throw new ConflictError(
        `Adjustment would push stock negative: before=${before} delta=${input.delta}`,
        { code: "negative_inventory" },
      );
    }

    if (input.shopSafetyLockOn && input.delta !== 0) {
      await writeAuditLog(tx, {
        shopId: input.shopId,
        bundleId: input.bundleId,
        shopifyInventoryItemGid: input.inventoryItemGid,
        locationGid: input.locationGid,
        action: "safety_lock",
        quantityBefore: before,
        quantityAfter: after,
        reason: "safety_lock",
        source: input.source,
        referenceId: input.referenceId,
        metadata: input.metadata,
      });
      await tx.inventorySyncState.upsert({
        where: {
          shopId_bundleId_locationGid: {
            shopId: input.shopId,
            bundleId: input.bundleId,
            locationGid: input.locationGid,
          },
        },
        create: {
          shopId: input.shopId,
          bundleId: input.bundleId,
          locationGid: input.locationGid,
          shopifyInventoryItemGid: input.inventoryItemGid,
          availableQuantity: before,
          lastSyncedAt: new Date(),
          syncStatus: "locked",
        },
        update: { syncStatus: "locked" },
      });
      return { before, after, locked: true };
    }

    await tx.inventorySyncState.upsert({
      where: {
        shopId_bundleId_locationGid: {
          shopId: input.shopId,
          bundleId: input.bundleId,
          locationGid: input.locationGid,
        },
      },
      create: {
        shopId: input.shopId,
        bundleId: input.bundleId,
        locationGid: input.locationGid,
        shopifyInventoryItemGid: input.inventoryItemGid,
        availableQuantity: after,
        lastSyncedAt: new Date(),
        syncStatus: "synced",
      },
      update: {
        availableQuantity: after,
        lastSyncedAt: new Date(),
        syncStatus: "synced",
      },
    });

    await writeAuditLog(tx, {
      shopId: input.shopId,
      bundleId: input.bundleId,
      shopifyInventoryItemGid: input.inventoryItemGid,
      locationGid: input.locationGid,
      action: input.action ?? "adjust",
      quantityBefore: before,
      quantityAfter: after,
      reason: input.reason,
      source: input.source,
      referenceId: input.referenceId,
      metadata: input.metadata,
    });

    return { before, after, locked: false };
  });
}

/** Stub kept for back-compat; domain code should use named imports. */
export class InventoryService {}
