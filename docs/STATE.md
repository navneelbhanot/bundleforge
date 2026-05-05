# STATE.md — Live Project State

> Updated at the end of every session, in the same commit as the work.

---

## Current milestone

**M-081 — Cart Transform Function: scaffold (JS)**

## Exact next action

Boot phase, then write `docs/specs/M-081-cart-transform-scaffold.md`.
Add a Shopify Function under `extensions/cart-transform/` (JS, not
Wasm to start). Skeleton: `run(input)` reading the Shopify Function
input shape and returning an empty `operations: []` plus the function
config TOML. Tests use the Function test runner.

## Blockers

None.

## Carry-overs (still active)

- Lint warnings only (no errors). All in stub-files-no-longer-stubs;
  clean up opportunistically.
- Broader Shopify SDK upgrade (api v13, app-express v7, prisma v6)
  flagged for ADR before going live.
- npm audit findings → M-140.
- `prisma/seed.ts` excluded from main tsc build; seed compiles under
  ts-node which is what `npm run db:seed` uses.

## Recently completed

- M-080 — orders/updated webhook. `docs/sessions/0078-order-webhooks.md`.
- M-079 — orders/cancelled webhook. `docs/sessions/0078-order-webhooks.md`.
- M-078 — orders/create webhook. `docs/sessions/0078-order-webhooks.md`.
- M-077 — SKU breakdown helper. `docs/sessions/0076-order-processor.md`.
- M-076 — order extract helper. `docs/sessions/0076-order-processor.md`.
- M-075 — inventory routes. `docs/sessions/0075-inventory-routes.md`.
- M-074 — safety lock (in M-070). `docs/sessions/0070-inventory-engine.md`.
- M-073 — recomputeBundleStock (in M-070). `docs/sessions/0070-inventory-engine.md`.
- M-072 — DB triggers (delivered M-009).
- M-071 — audit log writer. `docs/sessions/0070-inventory-engine.md`.
- M-070 — applyAdjustment transactional. `docs/sessions/0070-inventory-engine.md`.
- M-069 — bundle CSV import. `docs/sessions/0069-bundle-import.md`.
- M-061..M-068 — remaining vertical slices. `docs/sessions/0061-068-remaining-slices.md`.
- (Earlier history in PLAN.md.)

## Working branch

`claude/review-product-plan-jfMlf`
