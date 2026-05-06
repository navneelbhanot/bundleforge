# M-171b — Theme block reads displaySettings overrides

> Behavior wiring for M-171. The Bundle Detail Display tab
> persists per-bundle `displaySettings` and the shop-level
> Settings Display tab persists `settings.display` defaults.
> M-171b is the storefront side: the proxy merges them and
> the theme block actually applies the resolved values.

---

## Why

Today the App Proxy `/bundle/:slug` endpoint returns the
bundle's per-bundle `displaySettings` object as-is, and the
storefront Web Component (`<bundleforge-bundle>`) ignores
it entirely — it just renders a generic title + items list
regardless of layout/color/copy preferences.

M-171b closes both halves:
1. **Proxy** merges shop-level `settings.display` defaults
   under per-bundle `displaySettings` so the theme block
   sees a fully-resolved object. Per-bundle `null` values
   (set by the M-171 "Use shop default" Selects) fall
   through to the shop default.
2. **Web Component** reads three of the resolved fields
   and applies them at render:
   - `layout` (grid / list / carousel) → CSS class on the
     items list.
   - `colorPreset` (brand / neutral / high-contrast /
     minimal) → CSS class on the wrapper.
   - `cssOverride` → injected `<style>` block, scoped to
     this element via a generated id.

`addToCartCopy`, `imagePreference`, and `soldOutBehavior`
need richer rendering surfaces (a real Add-to-cart button,
component images, sold-out detection); they're left for a
future pass.

---

## Scope

### Server (proxy)

`src/routes/proxy.ts`:
- The shop's `settings.display` JSON is loaded alongside
  the bundle row and merged into the response:
  `displaySettings = { ...shopDefaults, ...bundleOverrides }`.
- Per-bundle `null` values (set by the merchant clicking
  "Use shop default" in M-171) are deleted by the existing
  `update()` deep-merge — no change here, the resolution
  is straightforward.

### Web Component

`extensions/theme-extension/assets/bundleforge-bundle.js`:
- Apply `bundle.displaySettings.layout` as
  `bundleforge-layout-<value>` CSS class on the items list.
- Apply `bundle.displaySettings.colorPreset` as
  `bundleforge-preset-<value>` CSS class on the wrapper.
- Inject `bundle.displaySettings.cssOverride` (when
  present) as a `<style>` tag inside the component, scoped
  via a generated id assigned to the wrapper.

Updated `bundleforge.css` with:
- `.bundleforge-layout-grid { display: grid; }`
- `.bundleforge-layout-list { display: block; }`
- `.bundleforge-layout-carousel` (horizontal scroll).
- `.bundleforge-preset-brand` / neutral / high-contrast /
  minimal — color-variable hooks.

### Tests

- `src/routes/proxy.merge.test.ts` (new, 3 cases):
  - Shop default applies when bundle override is empty.
  - Bundle override wins over shop default.
  - Unknown shop fields don't poison the response (only
    the M-171 keys are exposed).

- `extensions/theme-extension/displaySettings.test.ts`
  (new, 4 cases):
  - Pure helper that maps a resolved `displaySettings`
    object to `{ wrapperClass, listClass, scopedCss }`.
  - cssOverride round-trips wrapped in a `<style>` block
    with the scoped id.
  - Layout / colorPreset → matching CSS class.
  - Empty / null inputs → safe defaults.

---

## Acceptance criteria

- [x] Compiles, lints clean, all vitest pass.
- [x] Proxy `/bundle/:slug` returns a resolved
  `displaySettings` (shop defaults merged with bundle
  overrides).
- [x] Theme block applies layout + colorPreset CSS classes
  and injects cssOverride scoped to the component.
- [x] No new third-party deps.

---

## Out of scope (deferred)

- **`addToCartCopy`** — needs a real Add-to-cart button
  inside the web component. Today the component is
  display-only; cart adds happen via Shopify's product
  form.
- **`imagePreference`** — component images / bundle hero
  rendering. Fixed-bundle component photos vs single
  bundle hero is a real UX choice but it's a chunk of CSS
  + image-asset wiring on its own.
- **`soldOutBehavior`** — needs storefront stock data
  per component variant; out of scope without a richer
  inventory feed to the web component.
- **A11y review** of the new color presets.
