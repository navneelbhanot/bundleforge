# Session 0193 — Prisma 6.18.x pin + prod migrations applied

- **Date:** 2026-05-07
- **Milestone(s):** ops fix (no new milestone)
- **Branch:** claude/objective-sinoussi-77ae86

---

## Goal

Apply the five queued migrations (M-168, M-170, M-172,
M-173, M-174) to Railway production and unblock future
`prisma migrate deploy` calls — both the manual path and
the auto-migrate that runs on every Railway deploy via
`scripts/start-web.cjs`.

## What was done

### Verified migrations are already applied to prod

- Resolved the Postgres service name on Railway
  (`Postgres-cbqK`, not `Postgres`) and pulled
  `DATABASE_PUBLIC_URL` from its variables.
- Ran `npx prisma@6.18.0 migrate deploy` against the public
  URL → "No pending migrations to apply."
- Confirmed with `migrate status` → "Database schema is up
  to date!" All 9 migrations present, including the five
  this session was meant to apply:
  - `20260506160000_api_tokens_and_outbound_webhooks` (M-168)
  - `20260506180000_bundle_schedule_settings` (M-170)
  - `20260506200000_bundle_eligibility` (M-172)
  - `20260506220000_bundle_inventory_rules` (M-173)
  - `20260506240000_bundle_activity_log` (M-174)

They had auto-applied via `scripts/start-web.cjs`'s
`prisma migrate deploy` step on the previous Railway
deploy. STATE.md was stale on this point.

### Pinned Prisma to 6.18.x

`package.json`:
- `prisma`: `^6.19.3` → `~6.18.0`
- `@prisma/client`: `^6.19.3` → `~6.18.0`
- `@prisma/adapter-pg`: `^6.19.3` → `~6.18.0`

`npm install` re-resolved `package-lock.json` to 6.18.0
across all three.

### Why the pin

`prisma@6.19.3` ships PSL `7.1.1-3.<sha>` — Prisma rolled
the v7 enforcement (`url = env("DATABASE_URL")` in
`schema.prisma` is no longer accepted; must move to a new
`prisma.config.ts`) into a 6.x release. This broke the
`start:web` migrate step on Railway and the local
`prisma migrate deploy` workflow.

Pin to 6.18.x is the minimal fix: 6.18.0 still ships PSL
6.x and accepts the existing schema. The proper v7
migration (create `prisma.config.ts`, rewire the
PrismaClient constructor with `@prisma/adapter-pg` driver
adapter) is already noted in STATE.md's
"Future code work" section as not blocking launch, and is
unchanged by this pin.

### Updated STATE.md

- Removed the "User action required (five migrations
  queued)" block from the Exact next action section —
  they're applied.
- Added a note that Railway auto-runs `prisma migrate
  deploy` on every deploy (via `scripts/start-web.cjs`),
  so any new migration committed will land automatically;
  manual deploys are only needed for out-of-band cases.
- Added a "Recently completed" entry for this work.

## Tests + lint

- `npx prisma validate` (with dummy `DATABASE_URL`) →
  schema valid.
- `npm run typecheck` → clean.
- `npx vitest run` → 781 passed, 13 skipped (unchanged).
- `npm run lint` → 6 errors / 16 warnings (baseline,
  unchanged).

## Verified by hand

- `npx prisma --version` → CLI 6.18.0, client 6.18.0, PSL
  6.x (no longer 7.1.1-3).
- `npx prisma@6.18.0 migrate status` → "Database schema is
  up to date!" against Railway prod.

## Deferred

- **Prisma v7 migration** — `prisma.config.ts` + driver
  adapter for the runtime PrismaClient. Tracked in STATE.md
  Future code work; not blocking launch.

## Surprises

- The Postgres service on Railway is named `Postgres-cbqK`
  (with the random suffix), not `Postgres`. The CLI's
  `--service Postgres` returns "Service not found" without
  a fuzzy match. `railway status --json` exposes the full
  service name; future runbook updates might note this.
- The 6.19 wasm validator regression is recent (PSL bumped
  from 6.x to 7.1.1 inside a 6.x release line). Anyone
  doing a fresh `npm install` against the old `^6.19.3`
  pin would hit it. The pin protects them.

## Handoff

No queued roadmap milestone. STATE.md "Exact next action"
notes that any new migration on this branch will
auto-apply on the next Railway deploy.
