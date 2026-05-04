# ADR-0003 — Inventory Transactional Model + Immutable Audit Log

- **Status:** accepted
- **Date:** 2026-05-04
- **Deciders:** Claude Code session 0000, user

---

## Context

PRODUCT_PLAN §3.5 documents the dominant complaint about the closest
competitor (Simple Bundles): inventory randomly resets to zero, products show
out-of-stock incorrectly, checkout substitutes items. PRODUCT_PLAN §5 makes
"reliable inventory management" BundleForge's #1 differentiator.

ARCHITECTURE.md §3.2 prescribes a transactional sync engine with an immutable
audit log. This ADR formalizes the transactional model, the immutability
mechanism, and the safety lock workflow so subsequent inventory milestones
(M-070 through M-075) implement them consistently.

## Decision

All inventory mutations go through a single function:

```
inventory.applyAdjustment({
  shopId, bundleId, location, delta, reason, source, referenceId
})
```

Behavior:

1. Opens a Prisma `$transaction` with serializable isolation.
2. Acquires a row lock on the relevant `inventory_sync_state` row using
   `SELECT … FOR UPDATE`.
3. Writes a new `inventory_audit_log` row capturing `quantity_before`,
   `quantity_after`, `delta`, `reason`, `source`, `reference_id`, and any
   metadata.
4. Updates `inventory_sync_state` with the new quantity and `last_synced_at`.
5. Calls Shopify Admin GraphQL `inventoryAdjustQuantities` (or the equivalent
   for the operation type).
6. Commits on success. **Rolls back the entire transaction on any failure**,
   including Shopify API failures. There are no partial updates and no
   "best-effort" semi-applied state.

Concurrency: two simultaneous orders for the same bundle component serialize
through the row lock, eliminating oversell. A property-based concurrency test
(M-137) is the acceptance evidence.

Immutability of the audit log:

- The `inventory_audit_log` table has `REVOKE UPDATE, DELETE` applied to the
  application database role at migration time (M-072). The migration runs as
  a superuser/migrator role; the runtime role cannot mutate past entries.
- Application code never attempts to update audit rows. Lint rule (added if
  needed) flags any code that imports the audit model and calls `.update` or
  `.delete`.

Safety lock:

- When `Shop.settings.safety_lock = true`, an adjustment that would push
  Shopify-side stock to a different value writes the audit row with
  `sync_status = 'locked'` and **does not call Shopify**. A merchant
  approval workflow (M-074 + admin UI later) confirms the change before it
  is pushed.
- The audit log records both the locked attempt and the eventual approval as
  separate rows.

## Alternatives considered

- **Optimistic concurrency with version numbers and retry.** Rejected.
  Higher complexity, easier to get wrong in webhook-driven paths where
  retries are already happening at the queue layer.
- **Application-level mutex via Redis.** Rejected. A distributed lock that
  spans Postgres + Shopify API call windows is harder to reason about than
  a database row lock that already gates the only mutation path.
- **Append-only event log with no `inventory_sync_state` table; derive
  current state on read.** Rejected. Read-time derivation is too slow for
  storefront stock checks and the Cart Transform path.

## Consequences

- Positive
  - One code path for every inventory mutation. Easy to audit, easy to test.
  - Database-level immutability of the audit log defends against accidental
    or malicious deletion.
  - The audit log is the debugging tool for any reported inventory complaint:
    every change is attributable to a `reason`, `source`, and `reference_id`.
  - The safety lock is a clean compromise between automation and merchant
    control.
- Negative
  - Serializable isolation + row locks reduce throughput on hot bundles.
    Acceptable given the throughput Shopify itself supports per shop.
  - All inventory work is on the critical path of the writing transaction.
    Long-running Shopify API calls inside the transaction extend lock
    duration. Mitigated by tight Shopify timeouts (1–2 s) and by retrying
    via BullMQ on transient failures.
- Follow-ups
  - M-070 implements `applyAdjustment`.
  - M-071 implements the audit log writer used inside the transaction.
  - M-072 adds the migration that revokes UPDATE/DELETE on the audit table.
  - M-074 implements the safety lock branching.
  - M-137 adds the concurrency property test that proves no oversell.
