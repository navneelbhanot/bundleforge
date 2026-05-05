# Sessions 0070..0074 — Inventory engine

The core ADR-0003 work landed in this batch:

- `src/services/inventory/audit.ts` (M-071) — `writeAuditLog(tx,
  input)` writes the immutable audit row inside the caller's
  transaction.
- `src/services/inventory/index.ts` (M-070) —
  `applyAdjustment(input, repo)` runs `prisma.$transaction`,
  finds-or-upserts `inventory_sync_state`, computes before/after,
  rejects negative results, branches on safety lock (M-074), commits
  state + audit atomically. Returns `{before, after, locked}`.
  - `recomputeBundleStock(components)` (M-073) is a pure helper:
    `min(availableUnits / perBundle)`.
- M-072 (audit-log immutability triggers) was delivered as part of
  M-009's migration; the BEFORE-UPDATE trigger blocks any mutation,
  the BEFORE-DELETE trigger was relaxed in ADR-0003a so cascade
  delete from GDPR shop/redact can reach the audit table.

8 unit tests (recompute + 5 happy/guardrail/safety-lock branches).
296 tests pass.
