# M-173b — Cart Transform reads inventoryRules metafield

> Behavior wiring for M-173. Per-bundle inventory rules
> (`lowStockThreshold`, `oversellPolicy`,
> `pauseWhenComponentBelow`, `componentOnlyMode`,
> `lowStockAlertEnabled`) flow from the admin to a new
> product metafield, and the Cart Transform Function honors
> `componentOnlyMode` at expand time.
>
> **Shipped together with M-172b** in commit
> `501c82d` because the metafield-write path and the CTF
> runtime change live in the same files (`bundles.ts`
> publish flow + `run.graphql` + `run.js`). The split spec
> exists so the audit trail for each admin feature has its
> own entry.

---

## Why

The Inventory tab persists per-bundle rules but nothing
reads them at runtime. The most actionable rule for the
CTF is `componentOnlyMode`: when enabled, the storefront
already renders components individually (M-173 admin
intent), so the CTF must NOT expand the bundle product
into its components — that would duplicate the lines.

The other rules (`pauseWhenComponentBelow` etc.) need
real-time stock data the CTF can't fetch on its own;
they're informational metadata in the metafield for now.

---

## Scope

### Server

- `defaultCreateShopifyProduct` in `src/routes/bundles.ts`
  writes `bundleforge.inventory_rules` JSON on publish
  (alongside the M-172b `bundleforge.eligibility` write).
- `BundleService.publish` callback contract carries
  `inventoryRules: Record<string, unknown>` to the route.

### Cart Transform Function

- `run.graphql` reads `inventoryRulesMetafield` per line.
- `run.js` exposes pure
  `inventoryAllowsExpand(rules)`:
  - `componentOnlyMode === true` → returns false.
  - everything else → returns true.
- The expand-path skips the operation when
  `inventoryAllowsExpand` returns false. Same disposition
  as M-172b — the bundle stays as a placeholder line
  downstream.

### Tests

- `extensions/cart-transform/src/eligibility.test.ts`
  (shared with M-172b, +4 inventory cases).
- `src/services/bundles/index.test.ts` (+2 cases shared
  with M-172b).

---

## Acceptance criteria

- [x] Compiles, lints clean, all vitest pass.
- [x] On publish, the bundle product has 5 metafields
  (bundle_id, is_bundle, components, eligibility,
  inventory_rules).
- [x] `componentOnlyMode === true` blocks expand.
- [x] No new third-party deps.

## Out of scope (deferred)

- **Real-time `pauseWhenComponentBelow` enforcement**.
  Needs a stock-level fetch from the CTF, which Shopify
  Functions can't do today. Theme block can read live
  inventory via the Storefront API and hide the buy
  button when component stock falls below the threshold —
  M-173c if/when needed.
- **`lowStockThreshold` / `oversellPolicy` runtime
  effects**. Those drive the existing inventory engine
  paths (M-070..M-074) and the storefront low-stock
  banner. Not a CTF concern.
