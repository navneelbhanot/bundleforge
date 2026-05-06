# M-171 — Bundle Detail · Display tab

> Third milestone of Phase R2 (`docs/plans/rich-admin-ui-roadmap.md`).
> Per-bundle override layer for the shop-level Display defaults from
> M-162. No new schema column — uses the existing `Bundle.displaySettings`
> JSON column, which today is wholesale-replaced on update.

---

## Why

M-162 surfaces shop-level Display defaults: layout, color preset,
image preference, Add-to-cart copy, sold-out behavior, custom
CSS. Today **every bundle inherits those defaults**; a merchant
running a Black Friday sale can't make that one bundle render in
a high-contrast carousel without changing the shop default for
all bundles.

This milestone gives each bundle a per-bundle override surface
with explicit "Use shop default" semantics. The storefront block
reads:

```ts
const layout = bundle.displaySettings.layout ?? shop.settings.display.layout ?? "grid";
```

— per-bundle wins; shop fallback when not set; built-in default
last. The override layer lives in the consumer (theme block /
storefront API client). This milestone ships the admin surface
that lets merchants populate the per-bundle layer.

---

## Scope

### Server

`src/services/bundles/index.ts`:

- New `validateDisplay(input)` helper, mirrors the Zod from
  M-162's `DisplayPatch`:
  - `layout` ∈ `["grid", "list", "carousel"]` (optional).
  - `colorPreset` ∈ `["brand", "neutral", "high-contrast", "minimal"]`.
  - `imagePreference` ∈ `["component_photos", "bundle_hero", "auto"]`.
  - `addToCartCopy` 1..40 chars.
  - `soldOutBehavior` ∈ `["hide", "disable", "waitlist"]`.
  - `cssOverride` ≤ 8000 chars.
- `create()` already passes through `displaySettings`; add
  validation.
- `update()` switches from wholesale-replace to validate +
  deep-merge (matches the scheduleSettings pattern).

`getById` already returns the row including `displaySettings` —
no read-side change.

### Frontend

New `frontend/src/components/bundleDetail/DisplayTab.tsx`. Three
cards:

1. **Layout & visual style** — `Select` for layout (with a
   "Use shop default" option that maps to undefined), Select for
   colorPreset.
2. **Imagery & copy** — Select for imagePreference, TextField
   for addToCartCopy (40-char limit + counter, "leave blank to
   inherit"), Select for soldOutBehavior.
3. **Custom CSS** — multiline TextField (8000 chars) with the
   same brace-mismatch warning as M-162.

Each card has a per-card Save that fires `onSave({ displaySettings: { ... } })`
through the page-level handler. Soft brace-warning logic is
shared — extract to a tiny helper if it duplicates more than
twice across the codebase.

In `BundleDetailPage.tsx`:
- `BundleDetail` interface gains `displaySettings?: { ... }`
  with the same shape as the shop default.
- New tab branch for `display` wires `<DisplayTab />` with
  `bundle.displaySettings` and a `shopDisplayDefaults` prop
  fetched from `/api/v1/settings`. Display defaults are read at
  mount; the tab's `helpText` shows what the merchant is
  inheriting if a field is blank.

### Tests

- `src/services/bundles/index.test.ts`:
  - Persists displaySettings on create with all six fields.
  - Rejects unknown layout enum value.
  - Rejects cssOverride > 8000 chars.
  - Deep-merges: saving `colorPreset` alone doesn't drop a
    previously-saved layout.

- `frontend/src/components/bundleDetail/DisplayTab.test.tsx`
  (new):
  - Renders the three card headings.
  - Saving layout fires `onSave` with `displaySettings: { layout: "list" }`.
  - "Use shop default" option in the Layout select clears the
    field (sends `displaySettings: { layout: null }`, server
    treats null as "delete the override").
  - Mismatched-brace CSS surfaces the warning Banner.

---

## Acceptance criteria

- [x] Compiles, lints, all vitest pass.
- [x] /bundles/:id#display renders three real cards.
- [x] PUT round-trips every field; deep-merge preserves siblings.
- [x] "Use shop default" semantics work end-to-end (sending null
  removes the override).

---

## Out of scope (deferred)

- **M-171b** — theme blocks actually consuming the per-bundle
  override layer at storefront render time. Today's blocks read
  `shop.settings.display.*` only; M-171b extends them to read
  `bundle.displaySettings.* ?? shop.settings.display.*`. Most of
  the work is in the Liquid template + the bundleforge-bundle.js
  asset.
- Per-bundle layout previews in the Live Preview sidebar — the
  preview already takes pricing rules; extending it to react to
  `displaySettings` is a separate visual-polish ticket.
