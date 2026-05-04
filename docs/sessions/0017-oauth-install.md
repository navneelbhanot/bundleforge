# Session 0017 — OAuth install route

- **Date:** 2026-05-04
- **Milestone(s):** M-017

## What was done

- Wrote `docs/specs/M-017-oauth-install.md`.
- New `src/shopify/index.ts`: `buildShopify(opts?)` factory + `shopify`
  singleton. Wraps `@shopify/shopify-app-express` with our env config,
  bridges Shopify's logger into Pino, pins `ApiVersion.January25`
  (matches `shopify.app.toml`).
- Mounted `/api/auth` install route in `src/server/index.ts`.
- Installed `@shopify/shopify-app-session-storage-memory` (used until
  M-020 wires the Prisma adapter).
- Added `src/shopify/index.test.ts` (2 supertest cases): redirect to
  Shopify authorize URL on valid `?shop=`, no authorize redirect on
  missing `shop`.

## Acceptance criteria

- [x] All spec items satisfied. 86 tests pass.

## Surprises and learnings

- Shopify's logger config takes a callback and a severity enum. Bridged
  to Pino so all SDK logs flow through our structured pipeline.

## Handoff

Next: **M-018 — OAuth callback + token persistence**. Mount the
callback route, on successful auth `upsert` the `Shop` row with the
encrypted access token (M-002 utility), and redirect into the embedded
admin. Add tests using a stubbed Shopify response for the token
exchange.
