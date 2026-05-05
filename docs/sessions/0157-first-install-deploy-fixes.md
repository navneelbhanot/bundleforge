# Session 0157 — First Install on a Real Dev Store: Deploy + Auth Fixes

- **Date:** 2026-05-05
- **Milestone(s):** post-M-155 — operational
- **Branch:** claude/objective-sinoussi-77ae86
- **Commit(s):** 51c5339, 791e06b, c40769d, df24b86, 75b056d, 73e3cf1,
  237ba65, 76daaa6, 261b99e, d85983f, af0700b, 10996f5, 76433a5,
  5eedbf8, 90d90fb, daebefa, 9fac6c7

---

## Goal

User asked to install the app on their Shopify dev store (`devstore-2u6u4fcc.myshopify.com`) and exercise the embedded admin. Expected smoke test; got a deeper audit because the prior milestones had never been exercised end-to-end through a real install.

## What was done

A series of fixes — each one surfaced the next.

### Deploy / runtime
- **51c5339** drop `&&` chain in Railway `startCommand` — the `npm run release && npm run start:web` chain was silently losing the second half. Reduced to `npm run start:web` (the shim already runs `prisma migrate deploy` inline).
- **791e06b** spawn tsx as a child process. `require(require.resolve("tsx/cli")); require("../src/server/index.ts")` does **not** install a TS hook — `tsx/cli` is the argv parser, not a require hook. Subsequent require fell through to Node's plain-JS loader and crashed on a `: Express` type annotation. Replaced with `child_process.spawn(node, [tsxPath, entry])` + signal forwarding. Same fix in `start-worker.cjs` and `start-webhooks-worker.cjs`.
- **c40769d** empty commit to force Railway to actually pick up `791e06b` (Railway had skipped that commit and "redeployed" the prior one).

### Embed / iframe
- **df24b86** populate `shopify.app.toml` with the Railway URL + the real `client_id` (the file shipped with `your-app-url.com` placeholders).
- **75b056d** drop Helmet's `frameguard` (`X-Frame-Options: SAMEORIGIN`) and emit a per-request `Content-Security-Policy: frame-ancestors https://<shop> https://admin.shopify.com;`. Helmet's CSP was already off; this filled the gap.
- **73e3cf1** import `@shopify/polaris/build/esm/styles.css` in `frontend/src/main.tsx`. It had never been imported anywhere — the Vite build was emitting JS only, no CSS chunk.
- **237ba65** substitute the `%VITE_SHOPIFY_API_KEY%` placeholder server-side at boot. The Docker build doesn't pass build args, so Vite was leaving the placeholder literal in `index.html` and App Bridge couldn't initialize.
- **76daaa6** enable Vite sourcemaps temporarily to make minified runtime errors debuggable.
- **d85983f** drop Helmet's `Cross-Origin-Opener-Policy: same-origin` and `Cross-Origin-Resource-Policy: same-origin`. COOP severs the iframe ↔ admin.shopify.com `window.opener` channel that Shopify's "app loaded" detector polls — the merchant was seeing "This app can't load due to an issue with browser cookies."

### Auth flow
- **261b99e** extend the `Session` model with the columns `@shopify/shopify-app-session-storage-prisma` v9 needs: `userId`, `firstName`, `lastName`, `email`, `locale`, `emailVerified`, `refreshToken`, `refreshTokenExpires`. Migration `20260505160000_session_v9_fields`. The OAuth callback was returning 500 with "Unknown argument `userId`" on session.upsert — masked by the SDK's error handler doing `instanceof` against an undefined class, which surfaced as the cryptic "Right-hand side of 'instanceof' is not an object" in the browser.
- **af0700b** add `frontend/src/lib/authFetch.ts` — patches `window.fetch` for same-origin `/api/*` calls and attaches `Authorization: Bearer <jwt>` from `window.shopify.idToken()` (App Bridge v4 global). Without this every page-level fetch returned 302 to OAuth and either spun forever or visibly reload-looped.
- **10996f5** drop `scopes` from the `shopifyApp({ api: { ... } })` config. shopify-api v13 stores sessions with empty `scope`; passing `scopes` makes `validateAuthenticatedSession` call `session.isActive(api.config.scopes)` → `isScopeChanged(scopes)` returns true → 403 + reauthorize header → reauth loop. With scopes undefined, `isScopeChanged` short-circuits to false and the session passes on `hasAccessToken` alone. `shopify.app.toml` is now the single source of truth for scopes.

### Frontend
- **76433a5** add a real `BundleCreatePage`. The "Create bundle" button on the list pointed at `/bundles/new`, which had no route — fell through to `/bundles/:id` with id="new", fetched `/api/v1/bundles/new`, and the server's Prisma `findFirst` threw `P2023: invalid UUID` → 500. The new page POSTs to `/api/v1/bundles` and navigates to the detail page.

### Test coverage (the second half of the session)
- **5eedbf8** `tests/integration/server-spa.test.ts` — 9 tests, supertest against in-process `createApp()` with a synthetic `dist/frontend/index.html`. Locks in the embed-header contract: API-key substitution, CSS link present, no XFO/COOP/CORP, CSP `frame-ancestors` per-shop. Also dropped the `NODE_ENV !== "test"` gate on the SPA-serving branch in `src/server/index.ts` — the `fs.existsSync(spaIndex)` check below it is sufficient. Updated the existing 404 test to use an `/api/*` path so it doesn't break when `dist/frontend` is present.
- **90d90fb** `playwright.config.ts` + `tests/e2e/embedded-admin.spec.ts` + `tests/e2e/server-entry.ts` — 4 Playwright tests, real headless Chrome. Covers Polaris CSS actually applying (token CSS var resolves), authFetch attaches the JWT, `/bundles/new` mounts the create form, every top-level route resolves to 200 + #root mount. Blocks the App Bridge CDN script and stubs `window.shopify` so the suite doesn't need a real Shopify session.
- **daebefa** `tests/integration/auth-flow.test.ts` — 3 tests. Pre-seeds a session in `MemorySessionStorage`, mints HS256 JWTs by hand, intercepts the SDK's GraphQL probe with `undici.MockAgent` so `hasValidAccessToken` resolves. Direct regression test for the scope-mismatch reauth loop: a session with `scope: ""` must NOT trigger 302/reauth.
- **9fac6c7** `.github/workflows/ci.yml` — added the `e2e` job (cached Playwright browsers, no DB needed) and a `concurrency` block that cancels stale runs on rapid pushes.

## Acceptance criteria status

No spec exists for this session — it was reactive operational work, not a planned milestone. Treat the following as the implicit checklist:

- [x] App installs on a real Shopify dev store and reaches the embedded admin without OAuth crashing.
- [x] Embedded iframe renders inside `admin.shopify.com` (no XFO / COOP refusal).
- [x] Polaris styles actually apply (no raw HTML rendering).
- [x] App Bridge initializes (real `shopify-api-key` meta tag, not the literal placeholder).
- [x] Pages don't infinite-reload on auth.
- [x] "Create bundle" button doesn't 500.
- [x] Test count: 442 → 454 vitest + 4 Playwright. All green locally.
- [x] CI runs the new tests on every push and PR.
- [ ] **Bundle CRUD end-to-end tested by a real merchant.** Today the dev store install happened but the user wasn't observed using it past create. This is the ongoing acceptance criterion that no automated test fully replaces.

## Verified by hand

- Hit `https://bundleforge-production-37f5.up.railway.app/health` → 200 with `db: true, redis: true`.
- Pulled the served HTML and confirmed:
  - `meta name="shopify-api-key" content="59b24b…"` (real key, not `%VITE_*%`).
  - `<link rel="stylesheet" href="/assets/index-*.css">` present.
  - `Content-Security-Policy: frame-ancestors https://<shop> https://admin.shopify.com;` set per-request.
  - `X-Frame-Options`, `Cross-Origin-Opener-Policy`, `Cross-Origin-Resource-Policy` all absent.
- Watched Railway deploy logs across each fix — final state shows clean boot through `[start-web] handing off to tsx` and into `Server listening`.
- User confirmed app loaded inside Shopify admin with a working nav (after Polaris CSS fix).
- Ran the full test suite locally: `npm test` → 454 passed; `npm run test:e2e` → 4 passed.

## Deferred

- **Auth-flow Playwright test.** The vitest integration test (`auth-flow.test.ts`) covers the middleware logic. A full Playwright test that drives a real OAuth → embedded-admin flow with an undici-intercepted Shopify GraphQL probe would close the last gap, but needs more setup time and isn't strictly necessary while the merchant install is observable on the live URL.
- **Polaris-CSS-via-token check is the only CSS assertion.** A visual regression test (Percy, Playwright screenshots) would catch other styling regressions; not added.
- **Bundle detail / edit / publish / archive flows.** Today only verified install → list → create. Edit/publish/archive paths aren't exercised by either test or hand.
- **AI service + worker (`outstanding-nourishment`) on Railway are still wrong.** Worker has `startCommand: npm run start:web` instead of `npm run start:worker`; AI Service is FAILED with the same wrong start command. Both are user-side dashboard fixes, not code.

## Surprises and learnings

- **Most of today's bugs were not caught by the 442 prior tests.** Every single fix was for a class of issue unit tests can't see: deploy environment shape, embed header contract, build-time vs runtime substitution, real DB vs Memory storage, browser iframe semantics. The README's "ready for App Store submission" claim was true on paper (tests green) and false in practice (had never been installed). Documented this gap in the new test layers.
- **The Shopify SDK v13 → v7 shopify-app-express integration was not exercised end-to-end before today.** Two SDK-level surprises: the v9 PrismaSessionStorage adds 8 columns to the Session model (we had only 9 of the 17), and v13 stores sessions with empty `scope` so the v7 middleware's `isActive(scopes)` reauth-loops if you also pass `scopes` to the API config.
- **Helmet's defaults are wrong for embedded Shopify apps.** `X-Frame-Options`, `Cross-Origin-Opener-Policy`, and `Cross-Origin-Resource-Policy` all need to be off; only CSP `frame-ancestors` should constrain who can embed. This is a known Shopify-app gotcha that no internal doc captured.
- **`PRODUCT_PLAN.md`'s competitive-positioning claim of "high reliability" is currently aspirational.** The codebase has the features to compete; reliability is built by merchant-hours, not milestones, and the count today is single-digit.
- **No new ADR needed.** All today's fixes are corrections of mismatches with documented behavior, not new architectural decisions. ADR-0005 (the Shopify SDK 13 / Prisma 6 upgrade) covers the rationale for the upgrade itself.

## Handoff

`docs/STATE.md` updated in the same commit. Next session should:

1. Confirm with the user that bundle create + edit + publish + archive actually work end-to-end on the dev store.
2. Fix the worker (`outstanding-nourishment`) and AI Service start commands in the Railway dashboard (these are user-owned).
3. Decide whether to write the full Playwright OAuth-flow test (the only meaningful test gap left) or move on to whatever the user's next priority is.
4. Investigate whether the PRODUCT_PLAN's "competitive comparison" table needs to be replaced with a measured one (the user asked about this — answered with "I can't responsibly say, but here's how to find out").
