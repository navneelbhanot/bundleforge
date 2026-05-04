# Session 0013 — CI test workflow verified

- **Date:** 2026-05-04
- **Milestone(s):** M-013

## What was done

- Wrote `docs/specs/M-013-ci-test.md`.
- Verified `.github/workflows/ci.yml` test job by inspection:
  - Postgres 16 + Redis 7 services with health checks.
  - Env vars match `src/config/env.ts` schema (DATABASE_URL,
    REDIS_URL, ENCRYPTION_KEY 64-hex, SHOPIFY_*, NODE_ENV=test).
  - Steps: checkout, setup-node 20 with cache, `npm ci`, prisma
    generate, prisma migrate deploy, npm test.
  - `prisma migrate deploy` applies both the init migration and the
    audit-log immutability triggers.
- No functional change required.

## Acceptance criteria

- [x] All spec items satisfied.
- [x] Boot phase remains green (81 tests).

## Note on actual CI runs

This session pushes the workflow file but cannot trigger CI from inside
Claude Code. The first push of M-013 will trigger CI on GitHub; a
failing run is feedback for a follow-up commit, not a reason to revert.

## Handoff

Next: **M-014 — Dockerfile + docker-compose for local dev**. The
existing `Dockerfile` is minimal; review it. Add `docker-compose.yml`
with `postgres:16` and `redis:7` services so a contributor can run
`docker compose up -d` and then `npx prisma migrate deploy` to bring up
a working dev environment. Once deployed, run the seed.
