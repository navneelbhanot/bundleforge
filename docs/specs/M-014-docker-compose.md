# M-014 — Dockerfile + docker-compose for local dev

## Goal

Add a `docker-compose.yml` so contributors can run
`docker compose up -d` to bring up Postgres 16 + Redis 7 locally. Update
the runbook. Make a tiny fix to the existing `Dockerfile` (deprecated
`--only=production` → `--omit=dev`).

## Why

Every later milestone that wants to actually run code (vs. unit-test
pure functions) needs a local DB. Docker Compose is the lowest-friction
option that matches CI's image versions exactly.

## Out of scope

- A Dockerfile that builds the admin frontend. The `vite build` step
  inside the existing Dockerfile won't run until M-094 wires Vite. M-014
  does NOT try to make `docker build .` succeed end-to-end. The
  Dockerfile is parked for M-094+.
- Production deploy targets (Render/Fly/Railway). Out of scope until the
  user picks a host.

## Acceptance criteria

- [ ] `docker-compose.yml` exists with `postgres:16` (named volume),
      `redis:7`, sensible defaults, and matching env to `.env.example`.
- [ ] Runbook documents `docker compose up -d`, `npx prisma migrate
      deploy`, `npm run db:seed`.
- [ ] Boot phase remains green (no code change).

## Files touched

- `docker-compose.yml` (new)
- `Dockerfile` (one-liner fix)
- `docs/runbook.md`
- `.env.example` — no change (already has `localhost` URLs that work
  against compose).
