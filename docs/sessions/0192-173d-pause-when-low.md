# Session 0192 — M-173d · Storefront pauseWhenComponentBelow

- **Date:** 2026-05-07
- **Milestone(s):** M-173d
- **Branch:** claude/objective-sinoussi-77ae86

---

## What was done

- **Spec:** `docs/specs/M-173d-storefront-pause-when-low.md`.

### Server

- **New** `src/shopify/sessionFromShop.ts`:
  `loadOfflineSessionFromShop(domain)` reads the Shop row,
  decrypts `accessToken`, returns a Shopify
  `Session(isOnline=false)` suitable for the Admin GraphQL
  client. Returns null for unknown / uninstalled shops or
  empty-decrypt.
- **New** `src/shopify/inventory.ts`:
  - `getVariantInventory(session, variantGids[])` runs a
    single batched `nodes(ids: [...])` GraphQL query and
    returns a `Map<gid, number>`. Untracked variants
    (`inventoryQuantity = null`) are reported as
    `Infinity`.
  - Pure `computePaused(rules, components, inventory)`
    returns true iff `pauseWhenComponentBelow > 0` AND
    any component's stock is below the threshold.
    Components without a variant GID and missing-from-map
    variants are treated as `Infinity` — fail-open, so a
    Shopify glitch doesn't cost merchants conversions.

### Proxy

- `src/routes/proxy.ts` `/bundle/:slug`:
  - New `defaultComputePaused()` wires
    `loadOfflineSessionFromShop` →
    `getVariantInventory` → `computePaused`.
    Best-effort: any error logs and returns
    `paused: false`.
  - DI seam (`ProxyDeps.computePaused`) so tests stub
    without hitting Shopify.
  - Skips the Shopify call entirely when
    `pauseWhenComponentBelow` is 0 or absent — most
    bundles incur zero extra cost.
  - Response now includes `paused: boolean`.

### Web component

- `BundleforgeBundle.connectedCallback`: after the
  componentOnlyMode check, if `bundle.paused === true`,
  hide the widget or render a "currently unavailable"
  placeholder (per the block's `data-on-ineligible`
  setting).

## Tests

- `src/shopify/inventory.test.ts` (new, 9 cases):
  `computePaused` × 5 (threshold 0, all above, one
  below, missing variant fail-open, null variant GID
  skipped) + `getVariantInventory` × 4 (happy, untracked
  → Infinity, empty input no GraphQL, ignores non-variant
  nodes).
- `src/shopify/sessionFromShop.test.ts` (new, 3 cases):
  unknown shop → null, decrypted token → Session,
  empty-decrypt → null.

## Tests + lint

- `npx vitest run` → 781 passed, 13 skipped (+12 net new).
- Typecheck clean.
- Lint baseline unchanged.

---

## Closing the M-173 chain

M-173 (admin Inventory tab) → M-173b (CTF reads metafield)
→ M-173c (storefront componentOnlyMode hide) → M-173d
(storefront pause) is now complete. Every per-bundle
inventory rule that admins can set has runtime effect.
