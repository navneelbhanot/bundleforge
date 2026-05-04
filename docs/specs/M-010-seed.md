# M-010 — Prisma Seed Script

## Goal

Verify `prisma/seed.ts` compiles cleanly and extend it with one
additional bundle type (volume) plus a billing subscription record so a
freshly-migrated dev DB has enough data to exercise list/detail UIs in
later milestones.

## Why

Future milestones (M-049 bundle service, M-097 admin UI) will iterate
faster against a populated DB. Seeding is also the first sanity check
that the migration matches Prisma's runtime expectations.

## Out of scope

- Faker-style large-volume seeds. Single-digit rows per table is enough.
- Idempotent re-seeding via upserts on bundles. The current `create()`
  approach is fine — `prisma migrate reset` clears the DB before seeding.

## Acceptance criteria

- [ ] `npx tsc --noEmit prisma/seed.ts` (standalone) succeeds.
- [ ] Seed contains: 1 shop, 3 bundles (fixed, build_box, volume),
      1 billing_subscription row.
- [ ] `npm run db:seed` runs cleanly when a DB is available (deferred
      verification — M-014).

## Files touched

- `prisma/seed.ts` (extended)
- `docs/runbook.md` (mention `npm run db:seed`)
