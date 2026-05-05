# Session 0141 — Hardening (M-141..M-149)

- **Date:** 2026-05-05
- **Milestone(s):** M-141, M-142, M-143, M-144, M-145, M-146, M-147, M-148, M-149
- **Branch:** claude/review-product-plan-jfMlf

---

## Goal

Close the hardening phase: accessibility, observability, ops procedures,
GDPR endpoints, rate-limit tightening, and API documentation.

## What was done

### M-141 — Accessibility (WCAG AA)
- Installed `eslint-plugin-jsx-a11y` and `axe-core`.
- Added a per-frontend rules block to `eslint.config.mjs` enabling
  `jsx-a11y/recommended` against `frontend/**/*.{tsx,jsx}`.
- New smoke tests at `frontend/src/__a11y__/pages.test.tsx`: render
  Settings, Analytics-overview, and A/B-tests pages into jsdom and
  run axe-core for `wcag2a + wcag2aa` (color-contrast off — jsdom can't
  layout). All three pages pass with zero violations.
- Skipped `vitest-axe` — its `createRequire(import.meta.url)` shim
  trips vitest's loader; using `axe-core` directly is simpler.

### M-142 — Sentry coverage audit
- Added `captureException(err, …)` to BullMQ `worker.failed` listeners
  in `src/jobs/worker.ts` and `src/jobs/webhooksWorker.ts`. Without
  it, queue-side errors were logged only.
- Audit findings appended to `docs/runbook.md`. HTTP-side capture
  (`errorHandler`) was already comprehensive.

### M-143 — Datadog dashboards
- 4 dashboards as JSON under `monitoring/datadog/dashboards/`:
  `queue.json`, `webhook.json`, `sync.json`, `http.json`.
- `monitoring/datadog/README.md` documents required metric namespaces,
  import procedure, and recommended monitor thresholds.

### M-144 — Incident runbook
- `docs/runbook-incidents.md`: severity definitions, on-call rotation,
  alert routing matrix, common-issue playbook (DB outage, Redis
  outage, queue backlog, Shopify rate exhaustion, HMAC spike), backup
  drill, GDPR procedures.

### M-145 — Backup + restore
- `scripts/backup.sh` — `pg_dump | gzip` with rolling retention; designed
  to cron hourly.
- `scripts/restore.sh` — drops + recreates the public schema, then
  pipes the gzipped dump through `psql`. Refuses to run without
  `CONFIRM=yes`. Both executable.

### M-146 — GDPR export
- `POST /api/v1/gdpr/export` (mounted under the standard
  `validateAuthenticatedSession` + `requireShopSession` chain).
- `src/routes/gdpr.ts` returns shop metadata + bundles + orders +
  audit log + integrations, with `accessToken` / `credentials` /
  `secret` redacted.
- 4 unit tests in `src/routes/gdpr.test.ts` cover happy path, tenant
  scoping, 401 without session, 404 without shop.

### M-147 — GDPR delete-shop
- `POST /api/v1/gdpr/delete-shop` in the same router. Hard-deletes the
  Shop row scoped to `req.shopId`; FK cascade handles the rest.
- 3 tests cover happy path, 404 (already gone), 401.

### M-148 — Rate-limit hardening
- New per-IP secondary limiter (`buildIpRateLimiter` /
  `ipRateLimiter`) keyed on `req.ip`, mounted on `/api/auth/*`,
  `/api/webhooks/*`, and `/health` — the unauth surface that would
  otherwise burn nobody's budget.
- Production singleton uses Redis; under `NODE_ENV=test` it falls back
  to a memory adapter so existing /health and OAuth tests don't stall.
- `rateLimiter.test.ts` adds an abuse property test that hammers a
  small-budget instance and asserts 429 with `scope: ip` + `Retry-After`
  header.

### M-149 — OpenAPI doc
- `docs/openapi.yaml` (OpenAPI 3.0.3) covering /health, every
  `/api/v1/*`, App Proxy pricing endpoint, and the public Google feed.
- `scripts/check-openapi.mjs` — tiny structural linter (no YAML parser
  on the dep tree); runs as `npm run docs:openapi`.

## Acceptance criteria status

- [x] Compiles (`npm run typecheck`)
- [x] Lint passes (only pre-existing 2 warnings)
- [x] Tests pass (442 / 442; up from 431)
- [x] `docs:openapi` passes
- [x] Per-IP limiter blocks abuse with 429
- [x] GDPR export redacts credentials
- [x] GDPR delete cascades

## Verified by hand

- Ran `npm run docs:openapi`; output `docs:openapi OK`.
- Confirmed mounted rate limiter doesn't break `/health`.
- Read the merged JSON output of the GDPR export against the test
  fixture; `accessToken` is `[REDACTED]`, integration `credentials`
  redacted, plain fields untouched.

## Deferred

- Datadog dashboard JSON is in the v1 dashboard format — the import
  step assumes the operator imports via the web UI or `datadog-ci`.
  No Datadog API key is wired into CI.
- Backup script is bash; no Windows path. Ops is Linux-first.
- The HMAC monitor entries in the runbook reference a Cloudflare WAF
  rule that doesn't exist yet; documented as a future ops task.

## Surprises and learnings

- `vitest-axe` uses `createRequire(import.meta.url)` which fails under
  vitest's loader. `axe-core` directly is fine.
- `RateLimiterRedis` opens a connection on first `consume()` even with
  `lazyConnect: true` on the underlying ioredis client. Production
  singletons must therefore be guarded for tests; otherwise the test
  suite stalls 5 s on every limited route.

## Handoff

Next session: launch batch (M-150..M-155). See `docs/specs/M-150-155-launch.md`.
