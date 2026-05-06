# M-162 — Settings · Display tab

> Second milestone of Phase R1 (`docs/plans/rich-admin-ui-roadmap.md`).
> Builds out the Display tab in the SettingsPage shell created by
> M-161.

---

## Why

The Display tab is the merchant's lever for "what does a bundle
*look* like in my store" — the things they're most likely to want
to change after install (color, layout, copy). Today nothing on
this surface is configurable; theme blocks ship with hard-coded
defaults from `extensions/theme-extension/blocks/`. Every meaningful
competitor exposes layout + copy + sold-out behavior in their
admin; our parity-of-options story is incomplete without it.

This is per-shop *defaults* — individual bundles can override these
in their own Display tab (M-170) when that lands.

---

## Scope

### Server

Extend `PatchSchema` in `src/routes/settings.ts` with a `display`
subobject:

```ts
display: z.object({
  layout: z.enum(["grid", "list", "carousel"]).optional(),
  colorPreset: z.enum([
    "brand", "neutral", "high-contrast", "minimal"
  ]).optional(),
  imagePreference: z.enum([
    "component_photos", "bundle_hero", "auto"
  ]).optional(),
  addToCartCopy: z.string().min(1).max(40).optional(),
  soldOutBehavior: z.enum([
    "hide", "disable", "waitlist"
  ]).optional(),
  cssOverride: z.string().max(8000).optional(),
}).strict()
```

GET response gains a `display` subobject merged from
`settings.display`. Defaults are applied in the **frontend** (so
server can return raw stored values without inventing fallbacks):
```ts
const DEFAULTS = {
  layout: "grid",
  colorPreset: "brand",
  imagePreference: "auto",
  addToCartCopy: "Add to cart",
  soldOutBehavior: "disable",
  cssOverride: "",
};
```

PUT continues to deep-merge `display` like it does `general` (the
M-161 deep-merge logic is already general — extend the merger to
handle `display` the same way). Add a small `mergeSubobject` helper
to keep this DRY.

### Client

In `frontend/src/pages/SettingsPage.tsx`, replace the Display
PlaceholderTab with three cards:

1. **Layout & visual style** — `Select` for layout (grid / list /
   carousel), `Select` for colorPreset (Brand / Neutral / High
   contrast / Minimal). One Save button.

2. **Imagery & copy** — `Select` for imagePreference (component
   photos / bundle hero / auto), `TextField` for addToCartCopy
   (max 40 chars, with character counter), `Select` for
   soldOutBehavior (hide / disable / show waitlist). One Save.

3. **Custom CSS** — `TextField multiline=10` for cssOverride.
   Help text explains scope (`#bundleforge-storefront *`) +
   warning that bad CSS can break theme blocks. Lightweight
   client-side check: count `{` and `}` to flag mismatched braces.
   One Save.

Each card mirrors M-161's per-card Save pattern. Settings TabSpec
flips Display from `"deferred"` to `"ready"`.

### Tests

- `src/routes/settings.test.ts`:
  - PUT a valid display object → round-trips.
  - PUT layout: "weird" → 400 (enum rejection).
  - PUT cssOverride > 8000 chars → 400.
  - Deep-merge: PUT only `display.layout` doesn't drop a previously
    saved `display.colorPreset`.

- `frontend/src/pages/SettingsPage.test.tsx`:
  - Display tab no longer shows "being built in"; renders 3 cards.
  - Changing layout + Save calls PUT with `{ display: { layout: "list" } }`.
  - addToCartCopy accepts text and reports char count.
  - cssOverride with mismatched braces shows a soft warning (not a
    blocker — just a heads-up).

---

## Acceptance criteria

- [x] Compiles, lints, all vitest pass.
- [x] /settings#display renders three editable cards.
- [x] PUT round-trips every Display field individually and as a
  combined patch.
- [x] Deep-merge across cards still works (Save on Layout doesn't
  clobber CSS).
- [x] Display TabSpec status becomes `"ready"`.

---

## Out of scope (deferred)

- Per-bundle Display overrides (M-170 — Bundle Detail's Display tab).
- Theme blocks actually *consuming* these defaults at render time.
  This milestone surfaces the merchant settings; M-162b or a later
  pass wires the theme blocks to read them via metafields. Document
  in session log.
- Logo upload (still M-167).
