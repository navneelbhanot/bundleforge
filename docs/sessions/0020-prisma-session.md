# Session 0020 — Prisma session storage

- **Date:** 2026-05-04
- **Milestone(s):** M-020

## What was done

- `buildShopify()` now selects `PrismaSessionStorage` (prod) or
  `MemorySessionStorage` (test) based on `env.NODE_ENV`. Tests inject
  via `opts.sessionStorage`.

## Acceptance

- [x] All boot-phase commands green (98 tests).
- [x] Memory adapter still used under tests; no live-DB dependency.

## Handoff

Next: **M-021 — App Bridge token verification**. Add a middleware
that calls `shopify.validateAuthenticatedSession()` for embedded admin
routes (so `res.locals.shopify.session` is populated for M-019 to read).
This is the production glue between the React frontend's session token
and the backend.
