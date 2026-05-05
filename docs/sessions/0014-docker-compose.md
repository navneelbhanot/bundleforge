# Session 0014 — docker-compose for local dev

- **Date:** 2026-05-04
- **Milestone(s):** M-014

## What was done

- Wrote `docs/specs/M-014-docker-compose.md`.
- New `docker-compose.yml`: postgres:16 (named volume `bundleforge-pg`)
  + redis:7 (named volume `bundleforge-redis`), both with healthchecks.
  Default Postgres user/password/db = `bundleforge` /
  `bundleforge_dev` / `bundleforge`. Versions match CI.
- One-line Dockerfile fix: `--only=production` → `--omit=dev` (former
  is deprecated since npm 7).
- Runbook updated with the compose flow.

## Acceptance criteria

- [x] All spec items satisfied.
- [x] Boot phase remains green (81 tests, 0 lint errors).

## Deferred

- The Dockerfile's `vite build` step won't succeed until the admin
  frontend lands (M-094). The compose file does NOT build the app
  image; it only runs services.

## Handoff

Next: **M-015 — Sentry integration**. Add `@sentry/node`, initialize
in `src/config/sentry.ts` (no-op if no DSN), wire into the M-007
`captureError` seam, add tests that confirm the seam is invoked for 5xx
and not for 4xx.
