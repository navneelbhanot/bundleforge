# M-173d — Storefront-side pauseWhenComponentBelow enforcement

> Final companion to M-173. Hides the bundle on the
> storefront when any component's available stock falls
> under `inventoryRules.pauseWhenComponentBelow`.
>
> Strategy: server-driven. Proxy fetches per-component
> inventory via Shopify Admin GraphQL, computes a
> `paused: boolean` flag, returns it in the bundle
> response. Web component hides on `paused === true`.

---

## Why

`pauseWhenComponentBelow` was the last unenforced
inventory rule from M-173. Without it, an "active" bundle
keeps selling even after a component sells through — the
merchant gets backorders they can't fulfill.

A purely client-side enforcement (Storefront API from the
browser) would need a per-shop public token, per-component
stock queries, and CORS handling. Server-driven keeps
secrets server-side, batches all components into a single
GraphQL `nodes(ids: [...])` call, and reuses the proxy's
existing 60s `Cache-Control` so storefront load isn't
amplified.

The check is **only** performed when
`inventoryRules.pauseWhenComponentBelow > 0`, so most
bundles incur zero extra cost.

---

## Scope

### Server

New `src/shopify/sessionFromShop.ts`:
- `loadOfflineSessionFromShop(shopDomain)` reads the Shop
  row by `shopifyDomain`, decrypts `accessToken`, and
  constructs a Shopify `Session` object suitable for
  `shopifyGraphql`. Returns `null` when the shop isn't
  installed.

New `src/shopify/inventory.ts`:
- `getVariantInventory(session, variantGids[])` runs a
  single batched GraphQL `nodes(ids: [...])` query
  fetching `... on ProductVariant { id, inventoryQuantity }`.
  Returns a `Map<gid, number>`.
- `computePaused(rules, components, inventory)` pure
  helper: returns true when `pauseWhenComponentBelow > 0`
  AND any component's stock is below the threshold.

`src/routes/proxy.ts`:
- After loading the bundle, if
  `inventoryRules.pauseWhenComponentBelow > 0`, call
  `loadOfflineSessionFromShop(req.shopifyShopDomain)` →
  `getVariantInventory` → `computePaused`. Add
  `paused: boolean` to the response.
- Best-effort: a session-load or inventory-fetch error
  logs at warn and returns `paused: false` (fail-open
  rather than fail-closed — losing a sale because we
  couldn't reach Shopify is worse than serving a
  technically-paused bundle).

### Web component

`extensions/theme-extension/assets/bundleforge-bundle.js`:
- `BundleforgeBundle.connectedCallback`: after the
  componentOnlyMode check, if `bundle.paused === true`,
  hide the widget (or render a "currently out of stock"
  placeholder when `data-on-ineligible="placeholder"` —
  same convention as M-172c eligibility-fail).

### Tests

- `src/shopify/inventory.test.ts` (new, 4 cases):
  - `computePaused` with no rule → false.
  - `computePaused` with rule + all components ≥ → false.
  - `computePaused` with rule + one component below → true.
  - `getVariantInventory` returns a map keyed by GID
    (mocked GraphQL).
- `src/shopify/sessionFromShop.test.ts` (new, 2 cases):
  - Returns null for unknown shop.
  - Returns Session with decrypted accessToken for
    installed shop.
- Update `src/routes/proxy.test.ts` if needed (the new
  `paused` field flows through optional types so
  existing tests pass).

---

## Acceptance criteria

- [x] Compiles, lints clean (no new violations), all
  vitest pass.
- [x] When `pauseWhenComponentBelow=3` and any component's
  stock is < 3, proxy returns `paused: true`.
- [x] When `pauseWhenComponentBelow=0` (or absent), the
  inventory fetch is skipped.
- [x] Inventory fetch failures fail-open
  (`paused: false`).
- [x] Web component hides the widget on
  `paused === true`.
- [x] No new third-party deps.

---

## Out of scope (deferred)

- **Real-time updates**. The proxy 60s cache is good
  enough — a customer adds the bundle to cart within the
  cache window and the CTF will catch it (M-172b/M-173b
  refuse to expand). Server-side cart-line validation
  (M-086 checkout guardian) catches anything that slips
  past.
- **Per-component "low stock" badge** ("3 left!"). UI
  polish, not a runtime check.
- **Pause email/notification** to the merchant when a
  bundle gets paused. Wire into M-168b's webhook system
  later.
