# M-070..M-074 — Inventory engine

Implements the core ADR-0003 contract: every inventory mutation goes
through `applyAdjustment`, which writes an audit log row inside the
same transaction as the inventory_sync_state update.

## Files

- `src/services/inventory/audit.ts` (M-071) — `writeAuditLog` helper.
- `src/services/inventory/index.ts` (M-070) — `applyAdjustment(...)`,
  `recomputeBundleStock` (M-073), safety-lock workflow (M-074).
- `src/services/inventory/index.test.ts` — vi.fn'd tx surface.

## API

```ts
applyAdjustment({
  shopId, bundleId, locationGid, inventoryItemGid,
  delta,             // signed int (cents-equivalent for inventory: units)
  reason, source,
  referenceId?, metadata?,
  shopSafetyLockOn?  // controls M-074 branching
}): Promise<{ before: number; after: number; locked: boolean }>;
```

Behavior:
1. `prisma.$transaction(async tx => { ... })`.
2. Find or create `inventory_sync_state` row by (shopId, bundleId, locationGid).
3. Compute `before` and `after = before + delta`. Reject if `after < 0`.
4. If safety lock is on AND |delta| > 0: do NOT update sync_state; write audit
   with `action="safety_lock"`, mark `sync_status = "locked"`, return
   `{locked: true}`.
5. Otherwise: update sync_state with new available_quantity; write audit
   row with action/reason/source/referenceId.
6. Return `{before, after, locked}`.

## recomputeBundleStock (M-073)

Pure helper that, given a bundle's component stock levels and per-item
quantities, returns the maximum bundle multiples that can be sold
(`min(component.stock / item.quantity)`).

## Acceptance

- [ ] applyAdjustment unit tests: writes audit + sync state on success;
      rejects negative result; safety-lock branches.
- [ ] recomputeBundleStock unit tests: standard, divisor != 1.
- [ ] Audit fields populated correctly.

## DB grants (M-072)

Already enforced by the migration `20260504_audit_log_immutable` (BEFORE
UPDATE trigger on inventory_audit_log). M-072 is a verification
milestone (no new code) — the trigger is documented in ADR-0003.
