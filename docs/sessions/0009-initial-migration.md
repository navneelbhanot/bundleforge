# Session 0009 — Initial Prisma Migration (offline)

- **Date:** 2026-05-04
- **Milestone(s):** M-009

## What was done

- Wrote `docs/specs/M-009-initial-migration.md`.
- Generated `prisma/migrations/20260504_init/migration.sql` (348 lines)
  via `prisma migrate diff --from-empty` — no live DB or shadow DB
  required.
- Added `prisma/migrations/migration_lock.toml` (provider = postgresql).
- Removed `prisma/migrations/**/migration_lock.toml` from `.gitignore`
  (this file MUST be committed per Prisma convention).
- Added `prisma/migrations/20260504_audit_log_immutable/migration.sql`
  enforcing ADR-0003 via Postgres triggers (BEFORE UPDATE / BEFORE DELETE
  on `inventory_audit_log` raise an exception). Triggers chosen over
  REVOKE because the runtime role name varies by hosting environment.
- Updated `docs/runbook.md` with first-time apply commands.

## Acceptance criteria

- [x] migration.sql created for the init migration.
- [x] migration_lock.toml present and tracked.
- [x] All 12 schema models represented in the SQL (verified by skim).
- [x] Boot phase remains green (81 tests).
- [x] Runbook updated.

## Deferred

- `prisma migrate deploy` cannot run without a Postgres instance.
  M-014 brings up `docker-compose` and the runbook documents the apply
  step.

## Handoff

Next: **M-010 — Prisma seed script**. The existing `prisma/seed.ts`
imports from `../src/generated/prisma`. Verify it compiles under
ts-node and add minimal dev-store fixtures (one shop, one fixed bundle,
one mix-and-match bundle) that can be loaded after the migration runs.
