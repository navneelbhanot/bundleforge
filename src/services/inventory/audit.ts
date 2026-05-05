/**
 * Audit-log writer (M-071). Append-only by contract; the BEFORE-UPDATE
 * trigger from migration 20260504_audit_log_immutable enforces it at
 * the DB level.
 */
import type { Prisma } from "../../generated/prisma";

export type InventoryAction =
  | "adjust"
  | "set"
  | "reserve"
  | "release"
  | "sync"
  | "rollback"
  | "safety_lock";

export type InventoryReason =
  | "order_placed"
  | "order_cancelled"
  | "manual_adjust"
  | "sync"
  | "bundle_created"
  | "safety_lock";

export type InventorySource =
  | "webhook"
  | "admin"
  | "api"
  | "system"
  | "migration";

export interface AuditWriteInput {
  shopId: string;
  bundleId?: string | null;
  shopifyInventoryItemGid: string;
  locationGid: string;
  action: InventoryAction;
  quantityBefore: number;
  quantityAfter: number;
  reason: InventoryReason;
  source: InventorySource;
  referenceId?: string;
  metadata?: Record<string, unknown>;
}

export interface AuditWriter {
  inventoryAuditLog: {
    create(args: {
      data: Prisma.InventoryAuditLogUncheckedCreateInput;
    }): Promise<{ id: string }>;
  };
}

export async function writeAuditLog(
  tx: AuditWriter,
  input: AuditWriteInput,
): Promise<{ id: string }> {
  return tx.inventoryAuditLog.create({
    data: {
      shopId: input.shopId,
      bundleId: input.bundleId ?? null,
      shopifyInventoryItemGid: input.shopifyInventoryItemGid,
      locationGid: input.locationGid,
      action: input.action,
      quantityBefore: input.quantityBefore,
      quantityAfter: input.quantityAfter,
      quantityDelta: input.quantityAfter - input.quantityBefore,
      reason: input.reason,
      source: input.source,
      referenceId: input.referenceId,
      metadata: (input.metadata ?? {}) as Prisma.InputJsonValue,
    },
  });
}
