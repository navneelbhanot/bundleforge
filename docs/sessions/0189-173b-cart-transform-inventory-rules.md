# Session 0189 — M-173b · Cart Transform reads inventoryRules

- **Date:** 2026-05-06
- **Milestone(s):** M-173b
- **Branch:** claude/objective-sinoussi-77ae86

---

## What was done

This milestone shipped together with M-172b in commit
`501c82d`. The two share the metafield-write path
(`defaultCreateShopifyProduct` in `src/routes/bundles.ts`
writes both `bundleforge.eligibility` and
`bundleforge.inventory_rules` on publish) and the CTF
runtime (`run.graphql` fetches both, `run.js` exposes
both helpers). Splitting them artificially would have
just duplicated the surface.

Specifically for M-173b:

- `BundleService.publish` callback contract gains
  `inventoryRules: Record<string, unknown>`.
- `defaultCreateShopifyProduct` writes
  `bundleforge.inventory_rules` JSON metafield on first
  publish.
- `run.graphql` adds `inventoryRulesMetafield` per line.
- `run.js` adds the pure `inventoryAllowsExpand(rules)`
  helper — returns false when
  `componentOnlyMode === true`, true otherwise.
- The CTF expand-path consults the helper before emitting
  the expand operation; when component-only mode is on,
  the bundle line stays unchanged so the storefront's
  per-component rendering doesn't get duplicated.

## Tests

Covered alongside M-172b in
`extensions/cart-transform/src/eligibility.test.ts`:
- `inventoryAllowsExpand` happy / sad paths (4 cases).
- `run()` integration: componentOnlyMode → no expand
  operation.
Also covered in `src/services/bundles/index.test.ts`:
the publish callback receives the expected
`inventoryRules` payload (verbatim and defaulted to `{}`).

## Tests + lint

- `npx vitest run` → 749 passed, 13 skipped (no delta
  vs M-172b — same commit).
- Typecheck clean.
- Lint baseline unchanged.

## Deferred

- **`pauseWhenComponentBelow` real-time enforcement** in
  the CTF. Shopify Functions can't fetch stock; theme
  block + Storefront API is the right venue.
- **`lowStockThreshold` / `oversellPolicy`** are admin
  metadata for the existing inventory engine paths; not a
  CTF concern.

---

## Final note: behavior wiring sub-milestones complete

All six b-milestones the user requested in a single
session — M-167b, M-168b, M-170b, M-171b, M-172b, M-173b
— landed across commits 4802de4..501c82d. None of the
deferred storefront/worker integrations from M-167..M-173
remain. The only formal-roster items the user has not
addressed are:

- **Migration application** — five
  `prisma migrate deploy` events queued: M-168, M-170,
  M-172, M-173, M-174. These are operations work, not
  code.
- **M-164b** — admin Save action writes the
  `bundleforge.cart_default_mode` shop metafield the CTF
  already reads. Not in this batch.
