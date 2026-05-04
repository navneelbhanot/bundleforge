# Session 0018 — OAuth callback + token persistence

- **Date:** 2026-05-04
- **Milestone(s):** M-018

## What was done

- Wrote `docs/specs/M-018-oauth-callback.md`.
- New `src/shopify/install.ts`:
  - `persistShop(session, client?, encryptFn?)` — pure orchestrator with
    DI for the Prisma client and encrypt function. Encrypts the access
    token via M-002, upserts the Shop row, clears `uninstalledAt` on
    update path.
  - `afterAuth()` Express middleware reading `res.locals.shopify.session`
    and calling persistShop. Errors propagate to the M-007 error handler.
- `src/server/index.ts`: mounted the full callback chain
  (`callback() → afterAuth() → redirectToShopifyOrAppRoot()`).
- 6 unit tests covering encryption, upsert call shape, missing fields,
  and real-encrypt integration via the env-set key.

## Acceptance criteria

- [x] All spec items satisfied. 92 tests pass.

## Deferred

- Real Shop name / email / currency reconciliation requires a GraphQL
  call to `shop` query. M-022 (GraphQL client) + M-027 (`shop/update`
  webhook) handle this.

## Handoff

Next: **M-019 — Session middleware (`requireShopSession`)**. Build the
middleware that loads the `Shop` by `shopify-app-express`'s validated
session and attaches it to `req` for downstream routes. This is the
gate every authenticated API route will use. Tests use a fake session
storage plus a fake Prisma client.
