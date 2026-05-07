# M-173c — Storefront-side inventory rules (component-only)

> Companion to M-173b (CTF-side). M-173c hides the
> `<mintbundle-bundle>` widget on the storefront when
> `inventoryRules.componentOnlyMode === true` so the
> merchant's "render components individually" choice
> doesn't accidentally render twice.
>
> **`pauseWhenComponentBelow` enforcement is deferred to
> M-173d** — it needs live component stock data the proxy
> doesn't have without per-variant Storefront API queries
> from the browser, and that's a bigger design task.

---

## Why

`componentOnlyMode = true` says "show this bundle's
components individually on the storefront, not as a single
widget." If the merchant configures their theme to render
the components elsewhere (a separate section, a custom
block) but leaves the `<mintbundle-bundle>` block on the
page, the page would render both — the bundle widget AND
the per-component cards. Hiding the bundle widget at the
web component layer fixes that without touching theme
templates.

## Scope

### Server (proxy)

- `/bundle/:slug` already returns `inventoryRules` (added
  in M-172c's proxy work — same select payload). No
  additional change here.

### Web component

- `MintBundleBundle.connectedCallback` checks
  `bundle.inventoryRules?.componentOnlyMode === true` and
  hides the widget (`style.display = "none"`).

### Tests

- Covered alongside M-172c in
  `tests/storefront/eligibility.test.ts` — but
  componentOnlyMode is already exercised by the CTF-side
  tests (`extensions/cart-transform/src/eligibility.test.ts`).
  The storefront-side check is a one-line conditional;
  manual test in a dev store is sufficient. No new vitest
  cases for M-173c specifically.

---

## Acceptance criteria

- [x] Compiles, lints clean, all vitest pass.
- [x] When `inventoryRules.componentOnlyMode === true`, the
  storefront `<mintbundle-bundle>` widget hides.
- [x] No new third-party deps.

## Out of scope (M-173d)

- **`pauseWhenComponentBelow` live-stock enforcement.**
  Needs per-component stock fetches via Shopify's
  Storefront API or a denormalised inventory feed. The
  proxy could pre-compute "is this bundle currently
  paused?" but only if we maintain component-level stock
  state on the MintBundle side. M-173d's design.
