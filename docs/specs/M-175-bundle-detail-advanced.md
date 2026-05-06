# M-175 — Bundle Detail · Advanced tab

> Seventh and final milestone of Phase R2
> (`docs/plans/rich-admin-ui-roadmap.md`). Closes the per-bundle
> richness phase. Surfaces three things that don't fit anywhere
> else: SEO metadata, a raw-JSON inspector for the per-bundle
> JSON columns, and the "danger zone" actions (duplicate,
> delete).

---

## Why

Every other Phase R2 tab has a single coherent theme. Advanced
collects the three remaining surfaces:

1. **SEO** — the schema has had `seoTitle` / `seoDescription`
   columns since M-009 but no admin surface ever wrote to them.
   Merchants who care about discoverability need an entry
   point.
2. **Raw configuration** — the M-170..M-173 JSON columns
   (`config`, `displaySettings`, `scheduleSettings`,
   `eligibility`, `inventoryRules`) accumulate state via
   normal forms but a power user occasionally needs to see
   exactly what's stored — debugging a misbehaving theme block,
   exporting state for ticket submission, etc.
3. **Danger zone** — the BundleService has `duplicate()` and
   `softDelete()` since M-050 / M-052 but neither is reachable
   from the admin frontend. The Bundle Detail page is the
   right place: a merchant deleting a bundle is on its detail
   view, not the list page.

---

## Scope

### Server

- Extend `CreateBundleInput` (`src/types/index.ts`) with:
  - `seoTitle?: string | null`
  - `seoDescription?: string | null`
- `BundleService.create()` and `update()` (`src/services/bundles/index.ts`):
  - Validate length: title ≤ 60, description ≤ 320 (matches
    Shopify's own SEO field limits — anything longer is
    silently truncated by storefronts anyway).
  - `null` for either field clears the column. Empty string is
    treated as `null` (storage normalisation, no point keeping
    `""` and `null` distinct).
  - `update()` records a `seo_updated` activity log entry when
    either SEO field is in the patch.
- Update `bundleActivityRepo` action enum to include
  `"seo_updated"`.

No new migration — both columns exist already.

### Frontend

- New `frontend/src/components/bundleDetail/AdvancedTab.tsx`.
- Three cards:
  1. **Search engine listing** — TextField for `seoTitle`
     (max 60, with character counter), TextField multiline for
     `seoDescription` (max 320, counter). Per-card Save fires
     `onSave({ seoTitle, seoDescription })`. Empty strings
     send `null` to clear.
  2. **Raw configuration** — collapsible (Polaris `Collapsible`)
     read-only JSON view of the 5 per-bundle JSON columns,
     pretty-printed with `JSON.stringify(_, null, 2)`. Useful
     for debugging / ticket submission. Fixed monospaced font.
  3. **Danger zone** — two actions:
     - **Duplicate** — primary tone, calls
       `POST /api/v1/bundles/:id/duplicate`, redirects to the
       new bundle's detail page on success.
     - **Delete** — critical tone, opens a
       `Modal`-based confirmation ("Type DELETE to confirm")
       to prevent click-fatigue accidents. On confirm, calls
       `DELETE /api/v1/bundles/:id` and redirects to `/`.

- Wire into `BundleDetailPage`:
  - Add the tab branch.
  - Remove `advanced` from the placeholder-fallback condition
    (closes the placeholder fallback entirely — every tab is
    now wired).
  - Remove the unused `PlaceholderTab` component if no other
    tab uses it.

### Tests

- `src/services/bundles/index.test.ts` (+3):
  - Persists `seoTitle` and `seoDescription` on create.
  - Rejects `seoTitle` > 60 chars.
  - Update with empty string normalises to `null`.
  - Update with SEO fields appends a `seo_updated` activity.
- `frontend/src/components/bundleDetail/AdvancedTab.test.tsx`
  (new, 4 cases):
  - Renders the three card headings.
  - Editing SEO title + Save sends the patch.
  - Clicking Duplicate calls `POST /:id/duplicate`.
  - Clicking Delete + confirming the modal calls
    `DELETE /:id`.
- `frontend/src/pages/BundleDetailPage.test.tsx` (+1):
  - `#advanced` deep-link asserts the new
    "Search engine listing" heading renders.
  - Remove the now-obsolete placeholder regression test
    (every tab is wired).

---

## Acceptance criteria

- [x] Compiles, lints clean (no new violations), all vitest pass.
- [x] /bundles/:id#advanced renders three real cards.
- [x] SEO fields round-trip end-to-end.
- [x] Duplicate action redirects to the new bundle.
- [x] Delete action requires typed confirmation and redirects
  to the list.
- [x] **Phase R2 closes**: every Bundle Detail tab is wired.

---

## Out of scope (deferred)

- **Slug editing** — schema has no uniqueness constraint and
  the slug is referenced from `/api/proxy/bundle/:slug`,
  Shopify product handles, and analytics events. A safe edit
  flow needs a "redirect old → new" map. Deferred until a
  merchant asks.
- **SEO preview** — Google-style snippet rendering. Pure UX
  polish; the field accepts plain strings, the storefront
  handles rendering.
- **Hard delete** — the existing soft-delete path is the
  right default. A "Delete forever" tied to the GDPR
  shop-redact flow already exists at the shop level.
- **Bundle export** (JSON / CSV) — adjacent to the raw-config
  view; probably belongs in a dedicated import/export
  milestone alongside the M-127..M-130 importer story.
