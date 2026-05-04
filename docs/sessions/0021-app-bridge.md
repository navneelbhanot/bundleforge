# Session 0021 — App Bridge token verification

- **Date:** 2026-05-04
- **Milestone(s):** M-021

## What was done

- Wrote `docs/specs/M-021-app-bridge.md`.
- `src/server/index.ts`: mounted on `/api/v1`, in order:
  1. `shopify.validateAuthenticatedSession()` — validates the App Bridge
     token and populates `res.locals.shopify.session`.
  2. `requireShopSession()` — reads the session and attaches `req.shopId`
     / `req.shopDomain` for routes.

## Acceptance criteria

- [x] Both middleware mounted ahead of route handlers.
- [x] Boot phase remains green (98 tests).
- [x] No new runtime tests; the SDK middleware is exercised end-to-end
      only with real Shopify tokens, which we cannot fake in unit tests.

## Handoff

Next: **M-022 — GraphQL Admin API client wrapper**. Thin typed wrapper
around `shopify.api.clients.Graphql` so domain services don't import the
SDK directly. Add retry-on-throttle logic and a small unit test that
exercises the throttle-handling branch.
