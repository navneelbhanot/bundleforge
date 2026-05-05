# Session 0158 — Crisp + Storefront API + Bundle CRUD E2E + Railway runbook

- **Date:** 2026-05-06
- **Milestone(s):** post-M-155 — closing PRODUCT_PLAN audit gaps
- **Branch:** claude/objective-sinoussi-77ae86

---

## Goal

Close as many of the §4/§5 PRODUCT_PLAN audit gaps as possible in one session: live chat, Hydrogen/Storefront API surface, POS visibility, Worker/AI Service Railway start commands, and an end-to-end bundle CRUD integration test.

## What was done

### Crisp live chat (§5 #3 Support quality)

- New optional env var `CRISP_WEBSITE_ID` in `src/config/env.ts`.
- `src/server/index.ts` substitutes the meta tag at boot the same way it does the Shopify API key — empty string when unset, real id otherwise.
- `frontend/index.html` carries a `<meta name="crisp-website-id">` placeholder.
- New `frontend/src/lib/crisp.ts` reads the meta tag, lazy-loads `client.crisp.chat/l.js`, and pre-populates the chat session with the merchant's shop domain so support knows who's writing in. No-op when the meta tag is empty.
- `.env.example` documents the variable.

The actual support staffing (humans + 2-hour SLA) remains operational, not code — but the channel for them is now wired.

### Hydrogen / Storefront API (§4 row 11)

- New `src/routes/storefront.ts` mounts `/api/storefront/v1/`.
- Two endpoints, public and CORS-open:
  - `GET /api/storefront/v1/bundles/:shop/:slug` — published bundle composition + display config.
  - `POST /api/storefront/v1/bundles/:shop/:slug/validate` — cart-composition validation.
- `OPTIONS /.*/` preflight handler. (Express 5 dropped raw `*`; using a regex.)
- IP rate-limited via the existing M-148 limiter.
- Demoted POS to a dedicated roadmap item but **left Hydrogen as ✓** in PRODUCT_PLAN once the route lands.

### Bundle CRUD end-to-end integration test

- `tests/integration/bundle-crud-e2e.test.ts` drives the full lifecycle through real Express + real Prisma against a real test database:
  - POST → expect 201 + UUID
  - GET list → expect to find the new id
  - GET detail → expect right title
  - PUT → expect updated title
  - POST /publish → expect status active
  - POST /archive → expect status archived
- Plus a cross-tenant safety test: a JWT for shop A can NOT read a bundle owned by shop B (expect 403/404).
- Setup: pre-seeds a real Shop row, an offline session in MemorySessionStorage, mints HS256 JWTs by hand, and uses undici MockAgent to intercept the SDK's GraphQL probe so `hasValidAccessToken` resolves.
- `describe.skipIf` auto-skips when `DATABASE_URL` is missing or points at the default fake URL — the suite stays green on local-dev machines without docker compose.

### Railway runbook

- New `docs/runbook-railway.md` with step-by-step for:
  - `outstanding-nourishment` worker → `npm run start:worker`
  - `AI Service` → root directory `ai-service`, Dockerfile builder, no custom start command
  - Optional `CRISP_WEBSITE_ID` env var
  - Optional standalone webhooks-worker service
- Linked from `docs/STATE.md`.

### POS deferred — honest

POS visibility for a published bundle requires the bundle to be a real Shopify product. The current `publish()` in `src/services/bundles/index.ts:248` has the comment "Real Shopify product sync lands later" — and indeed it just sets `status: "active"` in the DB. Until the product-sync milestone lands, there's nothing to publish to the POS sales channel. Documented this dependency in `docs/STATE.md`'s blockers + future-code-work sections.

### Plan / state docs

- `docs/STATE.md` updated: new "Recently completed" entry, blockers reflect the publish-product gap, future code work pivoted from "POS / Hydrogen / live chat all roadmap" to "real publish-to-Shopify product sync is the gating milestone."
- `docs/runbook-railway.md` (new).

## Acceptance criteria status

- [x] Crisp lazy-loads when `CRISP_WEBSITE_ID` is set; no-op otherwise.
- [x] `/api/storefront/v1/bundles/:shop/:slug` returns published bundle JSON for any origin (CORS).
- [x] `/api/storefront/v1/bundles/:shop/:slug/validate` runs cart validation publicly.
- [x] Bundle CRUD test passes against a real Postgres (456 vitest passing locally with DB; 454 without).
- [x] Cross-tenant safety asserted by the same test.
- [x] Railway worker / AI Service runbook published.
- [ ] **POS publication** — blocked on real product sync. Out of scope here.
- [x] Playwright suite still green (5/5).
- [x] Lint + typecheck clean.

## Verified by hand

- Ran `DATABASE_URL=…/bundleforge_e2e npx vitest run tests/integration/bundle-crud-e2e.test.ts` → 2/2 passing, request log shows full CRUD walk.
- Ran full vitest with real DB → 456 passing.
- Ran full vitest without DB → 454 passing, CRUD suite skipped cleanly.
- Ran `npx playwright test` → 5/5 passing.

## Deferred

- **Real Shopify product sync on `publish()`** — the gating milestone. Multi-day. Once landed, POS publication is small (just a `productPublish` mutation against the POS publication ID).
- **Trial-warning emails** — needs SMTP provider + cron worker job. Not started.
- **Hydrogen helper SDK** — the route exists; a small `@bundleforge/hydrogen` npm package wrapping it would be merchant-friendly but not strictly necessary.

## Surprises and learnings

- **Express 5's path-to-regexp dropped raw `*`.** `router.options("*", …)` throws `TypeError: Missing parameter name at index 1`. Switched to `/.*/`. Worth flagging for any other code that assumed Express 4 path semantics.
- **POS visibility** sounds like a 30-minute feature flag; actually it requires the product to exist in Shopify, which we don't yet create. Honesty about this gap is what made me move POS out of the §4 matrix earlier.
- **The Storefront API surface was easier than expected** — the existing proxy route already had the right read shape; the storefront route is essentially the same query without the App-Proxy HMAC check. This is a feature: cart-side and storefront-side use the same query shape.

## Handoff

Next session should pick from one of:

1. **Publish creates a real Shopify product** — the largest remaining gap. After this, POS, theme-block product handle resolution, and order webhooks all work end-to-end.
2. **Trial-warning emails** — needs SMTP secrets + cron infrastructure.
3. Or whatever the user has prioritized after this batch.

User-owned, unchanged: Railway dashboard fixes per `docs/runbook-railway.md`; merchant verification of bundle CRUD on `devstore-2u6u4fcc.myshopify.com` (now testable end-to-end).
