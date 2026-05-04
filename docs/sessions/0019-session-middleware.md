# Session 0019 — Session middleware

- **Date:** 2026-05-04
- **Milestone(s):** M-019

## What was done

- Wrote `docs/specs/M-019-session-middleware.md`.
- New `src/middleware/shopSession.ts`:
  - `deriveDomain(req, res)` — session → header → query precedence.
  - `requireShopSession({loadShop?})` — DI-friendly factory; default
    loader queries `prisma.shop.findUnique`.
  - 401 paths: missing domain, unknown shop, uninstalled shop.
- Augmented `src/types/express.d.ts` with optional `shopId`,
  `shopDomain` on Request.
- 6 supertest cases cover all branches.

## Acceptance criteria

- [x] All spec items satisfied. 98 tests pass.

## Handoff

Next: **M-020 — Prisma session storage adapter**. Replace the in-memory
adapter passed to `buildShopify()` with the official
`@shopify/shopify-app-session-storage-prisma` adapter wired to our
Prisma client. M-001 carry-over: this resolves the dependency conflict
that originally forced `--legacy-peer-deps`.
