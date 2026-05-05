# M-009 — Initial Prisma Migration

## Goal

Generate the SQL for the first Prisma migration (`init`) without requiring
a live database, commit the resulting `prisma/migrations/` directory, and
document how to apply it once Postgres is available (M-014).

## Why

The migration files are version-controlled artifacts. Generating them now
locks the schema-to-SQL mapping into git, even though we can't *apply*
them until docker-compose lands. This unblocks every later milestone that
needs a stable migration history.

## Out of scope

- Actually running `prisma migrate deploy` against a live DB. Deferred to
  M-014 / M-016.
- Materialized views or BRIN indexes mentioned in ARCHITECTURE.md §4 —
  those are separate migrations, M-110 (analytics rollups).

## Design

Use `npx prisma migrate diff --from-empty --to-schema-datamodel
prisma/schema.prisma --script` to produce SQL without touching a DB,
then place it under `prisma/migrations/<timestamp>_init/migration.sql`.

This is the offline equivalent of `prisma migrate dev --create-only`,
which still needs a shadow database. `migrate diff` does not.

## Acceptance criteria

- [ ] `prisma/migrations/<timestamp>_init/migration.sql` exists, contains
      `CREATE TABLE "shops"`, `CREATE TABLE "bundles"`, etc., for all 12
      models in `schema.prisma`.
- [ ] `prisma/migrations/migration_lock.toml` exists with provider
      `postgresql`.
- [ ] Boot phase remains green.
- [ ] Runbook updated with the apply command.

## Files touched

- `prisma/migrations/<timestamp>_init/migration.sql` (new)
- `prisma/migrations/migration_lock.toml` (new)
- `docs/runbook.md` (apply command)

## Open questions

None. The migration file is generated mechanically.
