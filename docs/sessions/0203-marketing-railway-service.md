# Session 0203 — Marketing site Railway service + pricing sync

- **Date:** 2026-05-07
- **Milestone(s):** Operational (no roadmap milestone)
- **Branch:** claude/gallant-murdock-6987fe
- **Commit(s):** (this commit)

---

## Goal

Make `marketing/` deployable as its own Railway service and bring the
pricing block in sync with `src/services/billing/plans.ts`.

## What was done

- **Pricing fix in `marketing/index.html`.** The pricing section was
  three tiers ($0 / $29 / $99) with a 1,000-orders-on-Starter line and
  a 10,000-orders-on-Growth cap that contradict the live plan registry.
  Replaced with the canonical four tiers — Starter $0, Growth $12, Pro
  $35, Enterprise $129 — including annual prices ($115 / $336 / $1,238)
  computed via the same 20%-off formula in `plans.ts`. Caps and feature
  bullets now mirror `PLAN_FEATURES`. Added a one-line lead-in pointing
  at ToS §3.1 (fair-use) so the "unlimited" claim is honest. The
  pre-M-031 commit `7859370` already synced the legal docs and app
  listing; this closes the same drift in the marketing page.
- **Test-count claim de-staled.** The trust section's
  "823 / 823 tests passing" is a moving target; rewrote to reference
  passing suites generally + the three named differentiators (parity,
  inventory, significance).
- **Railway service files under `marketing/`:**
  - `server.cjs` — zero-dependency Node http static server (~90 lines).
    Maps `/` → `index.html`, `*` → matching file under `marketing/`,
    `/health` → 200 "ok". Sends nosniff / DENY frame / HSTS / referrer
    headers. SIGTERM-aware.
  - `package.json` — Node ≥20 engines pin, `npm start` →
    `node server.cjs`. No runtime deps.
  - `Dockerfile` — single-stage `node:20-alpine`, copies only
    `package.json server.cjs index.html`, ~50 MB image, wget-based
    HEALTHCHECK on `/health`.
  - `railway.json` — pins `DOCKERFILE` builder, healthcheckPath
    `/health`, ON_FAILURE restart with 5 retries.
  - `.dockerignore` — excludes README + Docker config from the build
    context (faster builds).
- **`marketing/README.md` rewrite.** Replaced the Cloudflare Pages
  guide with a step-by-step Railway service-setup guide (Root
  Directory: `marketing`, Watch Paths: `marketing/**` so backend
  commits don't trigger marketing redeploys). Added a pricing table
  flagging it as the source of drift to watch — "if `plans.ts`
  changes, also update `index.html`, `legal/terms-of-service.md` §3,
  and `docs/launch/app-listing.md`."
- **Reconciled boot-phase typecheck drift.** STATE.md claimed
  "Typecheck clean" but `npm run typecheck` failed with three
  TS7006 implicit-any errors on
  `src/services/billing/createSubscription.test.ts:26`. The
  `capturingGraphql` helper's arrow-fn params (`_session`, `_query`,
  `variables`) lacked types and the surrounding `as unknown as ...`
  cast doesn't backflow contextual typing into the inner arrow.
  Annotated them as `unknown` / `Record<string, unknown>` to match
  the true signature. Test still passes. CLAUDE.md §3.1 explicitly
  requires reconciling docs ↔ code drift in the boot phase, so this
  fix lands in the same commit as the marketing work.

## Verified by hand

- Ran `node server.cjs` from `marketing/`. `/health` → 200 "ok",
  `/` → 200 / `text/html; charset=utf-8` / 17,322 bytes,
  `/nope` → 404. Pricing block grep on the served HTML returns all
  four tiers `$0 / $12 / $35 / $129`.
- `npm run typecheck` exits 0 (was exiting 2 before the
  createSubscription test fix).
- `npm run lint` exits 0 — 2 errors / 18 warnings, all pre-existing
  and unrelated to this change. STATE.md claimed 6 / 16 last
  session; the 4-error delta likely closed during M-201/M-202 and
  was never reflected. Updated STATE.md to the true count.
- `npm test` — 873 passed / 13 skipped / 1 failed in the parallel
  run. The single failure is `tests/property/webhook.throughput.test.ts`
  with `socket hang up` — environment-specific port-pressure flake
  under concurrent test load. Re-ran in isolation: passes in 122 ms.
  Not caused by this session's changes; left as-is.

## Test status

- Vitest: 873 passed / 13 skipped / 1 flake (the throughput test
  passes in isolation; fails ~once when 137 test files run in
  parallel against macOS's ephemeral port budget).
- Typecheck: clean (0 errors).
- Lint: 2 pre-existing errors / 18 warnings (down from 6 / 16
  per the previous session log — net improvement that wasn't
  reflected in STATE.md).

## Deferred

- `/privacy` and `/terms` HTML pages — `legal/*.md` still has
  `{{placeholder}}` fields awaiting counsel. Will land when the
  user comes back from legal review. The footer links 404 in the
  meantime. Documented in `marketing/README.md` "What's NOT here yet".
- Web analytics — wire after privacy posture decided.
- `og:image`, favicon, apple-touch-icon — drop into `marketing/`
  and add them to the Dockerfile's `COPY` line + `index.html`
  meta tags.
- Webhook-throughput test flake — out of scope for the marketing
  deploy. Fix candidates: `pool: forks` for that single file, or
  serialize the file via `vitest --no-file-parallelism`.

## Surprises and learnings

- The previous "sync stale pricing" commit (`7859370`) updated
  legal/ToS and the App Store listing copy but missed
  `marketing/index.html`. Single-source-of-truth for plan pricing
  remains a coordination problem across at least four files; the
  new `marketing/README.md` table is the first place this is
  documented as a list rather than each file fixing itself in
  isolation.
- Railway services in this project benefit from
  `Watch Paths: marketing/**` to avoid rebuilding the marketing
  service on every backend commit. Not configurable via
  `railway.json` (yet) — must be set in the dashboard.

## Handoff

User action required:

1. **Railway dashboard:** create a new service in the BundleForge
   project; Source = this repo; Root Directory = `marketing`;
   Watch Paths = `marketing/**`. Generate a domain. Once green,
   add `bundleforge.app` as a custom domain and update DNS.
2. The two pre-existing user actions from session 0202 still stand:
   fix the worker / AI-Service `startCommand` mismatches in the
   Railway dashboard; complete Resend setup per
   `docs/ops/email-setup.md`.

Code: no queued milestone; the rich-admin-ui roadmap is closed.
Open backlog items live in STATE.md.
