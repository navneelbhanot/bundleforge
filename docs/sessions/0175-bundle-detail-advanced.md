# Session 0175 — Bundle Detail · Advanced tab (closes Phase R2)

- **Date:** 2026-05-06
- **Milestone(s):** M-175
- **Branch:** claude/objective-sinoussi-77ae86
- **Commit(s):** TBD

---

## Goal

Populate the last Phase R2 placeholder. The Advanced tab
collects three surfaces that don't fit elsewhere:

- **SEO** — wires `seoTitle` / `seoDescription` columns that
  have existed since M-009 but never had an admin entry point.
- **Raw configuration** — read-only JSON inspector for the 5
  per-bundle JSON columns (debugging / ticket submission).
- **Danger zone** — Duplicate (existing service method since
  M-050) and Delete (existing soft-delete since M-052).
  Neither was reachable from the admin frontend until now.

## What was done

- **Spec written:**
  `docs/specs/M-175-bundle-detail-advanced.md`.

- **Types** (`src/types/index.ts`):
  - Added `seoTitle?: string | null` and
    `seoDescription?: string | null` to `CreateBundleInput`.

- **Service** (`src/services/bundles/index.ts`):
  - New `validateSeo(seoTitle, seoDescription)` helper:
    title ≤ 60 chars, description ≤ 320 chars (matches
    Shopify storefront limits — anything longer is silently
    truncated by themes).
  - New `normaliseSeo()` helper: empty string → null. Removes
    the `""` vs `null` ambiguity at storage time.
  - `create()` validates + persists.
  - `update()` validates, normalises, and persists. `null`
    clears the column.
  - Activity log: new `seo_updated` action emitted from
    `update()` when either SEO field is in the patch.

- **Activity action enum** (`src/services/bundles/activityRepo.ts`):
  - Added `"seo_updated"` to `BundleActivityAction`.

- **Frontend** (`frontend/src/components/bundleDetail/AdvancedTab.tsx`,
  new file):
  - **Search engine listing** card — TextField for title with
    live char counter (60 max, error past max), multiline
    TextField for description (320 max, counter, error past
    max). Empty strings convert to `null` on save.
  - **Raw configuration** card — Polaris `Collapsible`
    showing pretty-printed JSON for each of the 5 per-bundle
    columns (`config`, `displaySettings`, `scheduleSettings`,
    `eligibility`, `inventoryRules`). Read-only. Monospaced
    `<pre>` blocks scoped to a Polaris-themed surface.
  - **Danger zone** card — Duplicate button (calls service
    duplicate, navigates to the new bundle). Delete button
    opens a typed-confirmation Modal — merchant must type
    `DELETE` to enable the destructive primary action.

- **BundleDetailPage** wiring:
  - `BundleDetail` interface gains
    `seoTitle?: string | null` and `seoDescription?: string | null`.
  - Added `<AdvancedTab>` tab branch.
  - Added `duplicate()` handler — `POST /:id/duplicate` then
    navigates to the new bundle's `#setup`.
  - Added `deleteBundle()` handler — `DELETE /:id` then
    navigates to `/`.
  - Imported `useNavigate` from `react-router-dom`.
  - **Removed** the placeholder fallback branch and the
    `PlaceholderTab` component entirely. Every tab is now
    wired so the placeholder code is dead. Trimmed the
    `TabSpec` interface accordingly (dropped `status` +
    `milestone` fields).

## Tests added

- `src/services/bundles/index.test.ts` (46 cases, +4):
  - Persists `seoTitle` and `seoDescription` on create.
  - Rejects `seoTitle` > 60 chars.
  - Update with empty string normalises to `null`.
  - Update with SEO fields appends a `seo_updated` activity.

- `frontend/src/components/bundleDetail/AdvancedTab.test.tsx`
  (new, 4 cases):
  - Renders the three card headings.
  - Editing SEO title + Save sends the patch.
  - Clicking Duplicate fires `onDuplicate`.
  - Clicking Delete + typing DELETE + confirming fires
    `onDelete`.

- `frontend/src/pages/BundleDetailPage.test.tsx` (10 cases,
  net same — replaced the placeholder regression test with a
  `#advanced` deep-link test):
  - `#advanced` deep-link asserts the new "Search engine
    listing" heading renders.
  - "Switching tabs preserves dirty title" updated to switch
    to `#advanced` (no placeholder tabs left to assert
    against).

## Acceptance criteria status

- [x] Compiles, lints clean (no new violations), 637/637 vitest pass.
- [x] /bundles/:id#advanced renders three real cards.
- [x] SEO fields round-trip end-to-end.
- [x] Duplicate redirects to the new bundle's setup tab.
- [x] Delete requires typed confirmation and redirects to `/`.
- [x] **Phase R2 closes**: every Bundle Detail tab is wired.

## Verified by hand

- `npx vitest run src/services/bundles/index.test.ts` → 46/46.
- `npx vitest run frontend/src/components/bundleDetail/AdvancedTab.test.tsx`
  → 4/4.
- `npx vitest run frontend/src/pages/BundleDetailPage.test.tsx`
  → 10/10.
- `npx vitest run` (full) → 637 passed, 13 skipped.
- `npm run typecheck` → clean.
- `npm run lint` → 6 pre-existing errors only; no new
  violations from M-175.

## Deferred

- **Slug editing** — schema has no uniqueness constraint and
  the slug is referenced from `/api/proxy/bundle/:slug`,
  Shopify product handles, and analytics events. A safe edit
  flow needs a redirect map. Wait for a merchant ask.
- **SEO snippet preview** — Google-style rendering is pure
  polish. The field accepts plain strings; theme-side
  rendering is unchanged.
- **Hard delete** — soft-delete is the right default. A
  "delete forever" path already exists at the shop level via
  the GDPR shop-redact webhook.
- **Bundle export (JSON / CSV)** — adjacent to the raw-config
  view; belongs in a dedicated import/export milestone with
  the M-127..M-130 importers.

## Notes — Phase R2 retrospective

Phase R2 (M-169..M-175) shipped seven milestones in one day,
turning the 500-line single-scroll Bundle Detail page into an
8-tab shell with each tab fully built:

- M-169: tab shell refactor + form-state-preserving Setup tab.
- M-170: Schedule (window + recurrence + end behavior).
- M-171: Display (per-bundle override of M-162's shop defaults).
- M-172: Customers (eligibility — tags, segments, markets, locales).
- M-173: Inventory (per-bundle override of M-163 + pause guard
  + component-only mode).
- M-174: Performance + Activity log (the latter introduced a
  new `bundle_activity_log` table and writers in publish/
  archive/softDelete/update).
- M-175: Advanced (SEO, raw-config inspector, danger zone).

The recurring pattern across M-170..M-173 — "validate +
deep-merge with null-removes-key" — is now established
convention. M-174 broke pattern slightly with its append-only
audit-log table (different shape because it's not a config
override). M-175 had no new pattern; it's an aggregation
surface.

Five migration files queued for `prisma migrate deploy`:
M-168 (api_tokens + outbound_webhooks), M-170
(bundle_schedule_settings), M-172 (bundle_eligibility),
M-173 (bundle_inventory_rules), M-174 (bundle_activity_log).
M-175 added no new schema column — `seoTitle` /
`seoDescription` were already in the schema since M-009.

Phase R3 next: Bundle List richness (IndexFilters + saved
views, Bulk actions, Sort + view modes, Templates gallery).
M-176..M-179.
