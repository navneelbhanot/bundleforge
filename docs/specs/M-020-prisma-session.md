# M-020 — Prisma session storage adapter

## Goal

Use `PrismaSessionStorage` from
`@shopify/shopify-app-session-storage-prisma` for production session
persistence. Memory adapter remains the default under `NODE_ENV=test`.

## Acceptance criteria

- [ ] `buildShopify()` selects `PrismaSessionStorage` when not in test.
- [ ] Tests still pass without a live DB (memory adapter used).
- [ ] M-001 carry-over note about session-storage-prisma version
      conflict is removed from STATE.md (resolved).

## Files touched

- `src/shopify/index.ts`
