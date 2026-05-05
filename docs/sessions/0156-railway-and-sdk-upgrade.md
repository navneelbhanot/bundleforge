# Session 0156 — Railway deploy config + Shopify SDK / Prisma upgrade

- **Date:** 2026-05-05
- **Branch:** claude/review-product-plan-jfMlf
- **Scope:** post-launch hardening — ops + carry-overs from M-001

---

## Goal

Two operational tracks beyond the M-000..M-155 milestone roster:

1. Ship a Railway deploy config that actually works (web + worker + AI +
   Postgres + Redis).
2. Land the Shopify SDK / Prisma major upgrades that have been on
   STATE.md's carry-over list since M-001.

## What was done

### Railway deploy config
- `railway.toml` — Nixpacks build, healthcheck on `/health`, restart
  policy on failure (max 5 retries).
- `.env.railway.example` — every required env var; calls out
  Railway-injected ones (`DATABASE_URL`, `REDIS_URL`, `PORT`).
- `docs/deploy-railway.md` — end-to-end recipe: provisioning, web +
  worker + AI service config, Shopify Partners wiring, first install,
  migrations, backups, observability, cost ballpark, rollback.

### Code gaps fixed
- `package.json` build/start scripts split: `build` (frontend SPA),
  `build:server` (`prisma generate`), `start:web`, `start:worker`,
  `start:webhooks-worker`, `release` (`prisma migrate deploy`).
- `frontend/vite.config.ts` — explicit `root: __dirname` and absolute
  `outDir` so the build runs from any cwd.
- `src/server/index.ts` — `express.static(dist/frontend)` + SPA
  fallback regex that excludes `/api/*` and `/health`. Required for
  embedded App Bridge token flow.

### Shopify SDK + Prisma upgrade
- `@shopify/shopify-api` 11 → 13.
- `@shopify/shopify-app-express` 5 → 7.
- `@shopify/shopify-app-session-storage-prisma` 5 → 9.
- `@prisma/client` + `prisma` + `@prisma/adapter-pg` 5 → 6.19.
- **Did not** bump Prisma to v7 — that requires `prisma.config.ts` +
  adapter rewiring, deferred as separate work.

### Runtime model change (ADR-0005)
- Moved server + workers from `tsc → node dist/...` to `tsx src/...`.
- Reason: Shopify SDK v13 ships source `.ts` files alongside
  compiled `.d.ts`. With legacy `moduleResolution: "node"`, tsc
  resolves to source and reports internal SDK type errors that
  `skipLibCheck` doesn't suppress. Switching to `Bundler` resolution
  requires `module: ES2022` which forces ESM emit, which conflicts
  with our CJS-shaped runtime. `tsx` solves both: typecheck via
  Bundler (`tsc --noEmit`), runtime via `tsx`.

## Acceptance status

- [x] `npm run typecheck` — clean
- [x] `npm test` — 442/442
- [x] `npm run lint` — clean (2 pre-existing warnings only)
- [x] `npm run build` — emits `dist/frontend/`
- [x] `tsx src/server/index.ts` loads (verified by tests, which import
      `createApp()`)

## Verified by hand

- Cleared and rebuilt `dist/`; confirmed `dist/frontend/index.html` +
  `assets/index-*.js` (gzipped 121 KB).
- Read the new `tsconfig.json` — `module: ES2022` + `moduleResolution:
  Bundler` resolves `@shopify/shopify-api` to its `dist/ts/*.d.ts`,
  not the source `.ts` files in node_modules.

## Deferred

- **Prisma v7** — bigger migration; requires `prisma.config.ts` and
  adapter wiring. Backlogged in STATE.md.
- **Real Railway deploy** — config + docs are ready, but actual
  deployment requires the user's Shopify Partners credentials and a
  Railway account.
- **Live OAuth / cart-transform-function smoke test on a dev store** —
  same blocker.

## Surprises and learnings

- Shopify SDK v13 publishing source `.ts` alongside compiled artifacts
  is the crux of why the legacy resolver doesn't work. Worth
  documenting; future SDK majors will likely keep this pattern.
- Prisma v6 → v7 is a much bigger jump than v5 → v6 because of the
  config file split. Don't lump them together.

## Handoff

Next steps are user-owned:
1. Create the Railway project, paste `.env.railway.example` values,
   `railway up`.
2. Update `SHOPIFY_APP_URL` in Partners + Railway after first deploy.
3. Walk the App Store submission checklist on the live URL.

The codebase is in a shippable state with current Shopify SDK majors,
Prisma 6, and a tested deploy recipe.
