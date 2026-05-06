# Session 0171 — Bundle Detail · Display tab

- **Date:** 2026-05-06
- **Milestone(s):** M-171
- **Branch:** claude/objective-sinoussi-77ae86
- **Commit(s):** TBD

---

## Goal

Populate the Display tab placeholder added by M-169 with a real
per-bundle override layer over the M-162 shop-level Display
defaults. Merchants need to render one bundle differently
without flipping the shop default.

## What was done

- **Spec written:** `docs/specs/M-171-bundle-detail-display.md`.

- **Server** (`src/services/bundles/index.ts`):
  - New `validateDisplay(input)` helper mirrors M-162's shop-level
    Zod (`DisplayPatch`):
    - `layout` ∈ grid / list / carousel.
    - `colorPreset` ∈ brand / neutral / high-contrast / minimal.
    - `imagePreference` ∈ component_photos / bundle_hero / auto.
    - `addToCartCopy` 1..40 chars.
    - `soldOutBehavior` ∈ hide / disable / waitlist.
    - `cssOverride` ≤ 8000 chars.
  - `null` is allowed for any field (validation skips); `undefined`
    is also tolerated.
  - `create()` validates `displaySettings` if present.
  - `update()` switches from wholesale-replace to validate +
    deep-merge. **`null` for a key means "remove the override"**
    — `delete merged[k]` so the storefront falls back to the
    shop default at render time. This is the linchpin of the
    override semantics.

- **Frontend**
  (`frontend/src/components/bundleDetail/DisplayTab.tsx`, new):
  - Three cards: `LayoutCard`, `ImageryCard`, `CssCard`.
  - Each Select has a special `__use_shop__` value as the first
    option, mapped to `null` on save.
  - `helpText` on every control surfaces what the merchant is
    currently inheriting from the shop default ("Inheriting
    'carousel' from shop default layout").
  - Empty `addToCartCopy` is sent as `null` so the override is
    deleted on save (rather than persisting an empty string).
  - `CssCard` reuses the brace-mismatch warning pattern from the
    M-162 shop-level CSS card.

- **Page wiring**
  (`frontend/src/pages/BundleDetailPage.tsx`):
  - `BundleDetail` interface gains `displaySettings?` typed by
    the imported `DisplaySettings`.
  - New `shopDisplayDefaults` state + lazy `useEffect` that
    fetches `/api/v1/settings` only when the merchant lands on
    the Display tab. Avoids a second GET on every Detail mount.
  - Display tab branch in the active-tab switch wires
    `<DisplayTab />` with `bundle.displaySettings`,
    `shopDisplayDefaults`, and the page's existing `save()` as
    `onSave`.

## Tests added

- `src/services/bundles/index.test.ts` (27 cases, +6):
  - Persists displaySettings on create with all 6 fields.
  - Rejects unknown layout enum value.
  - Rejects cssOverride > 8000 chars.
  - Rejects empty / > 40 char addToCartCopy.
  - Update deep-merges (saving colorPreset alone keeps layout).
  - Update with `null` removes the override (falls back to shop
    default at render time).

- `frontend/src/components/bundleDetail/DisplayTab.test.tsx`
  (new, 5 cases):
  - Renders Layout / Imagery / Custom CSS headings.
  - Layout save sends the chosen value.
  - "Use shop default" on a previously-overridden field sends
    `null` (not the previous value).
  - Custom CSS card flags mismatched braces.
  - Layout helpText surfaces the inherited shop-default value.

- `frontend/src/pages/BundleDetailPage.test.tsx` (6 cases, ±0):
  - Updated the `#display` deep-link test to assert the new
    `Layout & visual style` heading renders (Display is wired
    now, no longer a placeholder).
  - Placeholder regression test continues to use `#customers`
    pointing at M-172.

## Acceptance criteria status

- [x] Compiles, lints clean, 593/593 vitest pass.
- [x] /bundles/:id#display renders three real cards.
- [x] PUT round-trips every field; deep-merge preserves siblings.
- [x] "Use shop default" semantics work end-to-end.

## Verified by hand

- `npx vitest run src/services/bundles/index.test.ts` → 27/27.
- `npx vitest run frontend/src/components/bundleDetail/DisplayTab.test.tsx`
  → 5/5.
- `npx vitest run frontend/src/pages/BundleDetailPage.test.tsx`
  → 6/6.
- `npx vitest run` (full) → 593 passed, 13 skipped on second run
  (first run had a flake in errorHandler.test.ts unrelated to
  this milestone — passed isolated).
- `npm run typecheck` → clean.

## Deferred

- **M-171b** — theme blocks and the bundleforge-bundle.js asset
  consuming the per-bundle override layer at storefront render
  time. Today's blocks read the shop-level
  `settings.display.*` only. The override merge logic at the
  data layer is locked in by today's tests; the consumer-side
  read is a separate ticket because it touches Liquid templates
  and the storefront JS bundle.
- Per-bundle layout previews in the Live Preview sidebar —
  separate visual-polish ticket.

## Notes

The "null deletes the override" semantics is the part most
worth flagging. Three layers of priority at storefront render
time:

```ts
const layout =
  bundle.displaySettings.layout                  // per-bundle override
  ?? shop.settings.display.layout                // shop default
  ?? "grid";                                     // built-in fallback
```

If the merchant flips a Select back to "Use shop default", the
admin sends `{ layout: null }`; the server merge removes the
key from the persisted blob; the storefront falls through layer
2. This avoids the alternative — keeping the field in the blob
with some sentinel value — which would have meant the storefront
needs to know the sentinel and treat it specially.

The Schedule and Display tabs now share the deep-merge update
pattern (Display added to the same code path Schedule
introduced in M-170). When the next two tabs land (Customers,
Inventory in M-172/173), they should follow the same shape.
