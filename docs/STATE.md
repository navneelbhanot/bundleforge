# STATE.md — Live Project State

> Updated at the end of every session, in the same commit as the work.

---

## Current milestone

**M-030 — GDPR webhook: shop/redact**

## Exact next action

Boot phase, then write `docs/specs/M-030-shop-redact.md`. Hard-delete
Shop row by shopifyDomain (FK CASCADE removes bundles, items, orders,
sync state, etc.). The audit-log trigger blocks per-row DELETE, so
cascade against `inventory_audit_log` will fail — handle by purging
audit rows for that shop in a separate transaction (the trigger only
fires on application DELETE statements; superuser delete bypasses, but
prisma uses the app role). Decision: drop the trigger only for
shop_id = X within the txn, then re-enable. Or: detach FK to allow
orphan rows. Pick the simpler one in the spec.

## Blockers

None.

## Carry-overs (still active)

- Pre-existing stubs in tsconfig exclude: `src/services/bundles/index.ts`
  (M-049 will rewrite + re-include), `src/routes/bundles.ts` (M-053).
  M-006 cleared `src/server/index.ts`.
- Lint deferred to M-012.
- Broader Shopify SDK upgrade (api v13, app-express v7, prisma v6, etc.)
  flagged for ADR before M-016.
- npm audit findings (~13 moderate after pino-http + supertest) → M-140.
- `prisma/seed.ts` excluded from main tsc build; M-010 verifies it
  compiles under ts-node.

## Recently completed

- M-029 — customers/redact. `docs/sessions/0029-customers-redact.md`.
- M-028 — customers/data_request. `docs/sessions/0028-customers-data-request.md`.
- M-027 — shop/update. `docs/sessions/0027-shop-update.md`.
- M-026 — app/uninstalled + handler registry. `docs/sessions/0026-app-uninstalled.md`.
- M-025 — Webhook dispatcher. `docs/sessions/0025-webhook-dispatcher.md`.
- M-024 — Webhook HMAC verifier. `docs/sessions/0024-webhook-hmac.md`.
- M-023 — REST client wrapper. `docs/sessions/0023-rest-client.md`.
- M-022 — GraphQL client wrapper. `docs/sessions/0022-graphql-client.md`.
- M-021 — App Bridge session validation. `docs/sessions/0021-app-bridge.md`.
- M-020 — Prisma session storage. `docs/sessions/0020-prisma-session.md`.
- M-019 — Session middleware. `docs/sessions/0019-session-middleware.md`.
- M-018 — OAuth callback + persist. `docs/sessions/0018-oauth-callback.md`.
- M-017 — OAuth install. `docs/sessions/0017-oauth-install.md`.
- M-016 — Shopify app config. `docs/sessions/0016-shopify-app-config.md`.
- M-015 — Sentry integration. `docs/sessions/0015-sentry.md`.
- M-014 — docker-compose. `docs/sessions/0014-docker-compose.md`.
- M-013 — CI test job verified. `docs/sessions/0013-ci-test.md`.
- M-012 — ESLint + CI lint. `docs/sessions/0012-eslint.md`.
- M-011 — CI typecheck. `docs/sessions/0011-ci-typecheck.md`.
- M-010 — Seed script. `docs/sessions/0010-seed.md`.
- M-009 — Initial Prisma migration (offline). `docs/sessions/0009-initial-migration.md`.
- M-008 — Rate limiter. `docs/sessions/0008-rate-limiter.md`.
- M-007 — Error handler. `docs/sessions/0007-error-handler.md`.
- M-006 — Server scaffold + /health. `docs/sessions/0006-server-scaffold.md`.
- M-005 — Redis + BullMQ. `docs/sessions/0005-redis-bullmq.md`.
- M-004 — Prisma client. `docs/sessions/0004-prisma-client.md`.
- M-003 — Pino logger. `docs/sessions/0003-logger.md`.
- M-002 — Encryption utility (AES-256-GCM). `docs/sessions/0002-encryption.md`.
- M-001 — Env validation. `docs/sessions/0001-env-bootstrap.md`.
- M-000 — Bootstrap planning system. `docs/sessions/0000-bootstrap-planning-system.md`.

## Working branch

`claude/review-product-plan-jfMlf`
