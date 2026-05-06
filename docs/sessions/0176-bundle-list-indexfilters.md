# Session 0176 — Bundle list · IndexFilters + saved views

- **Date:** 2026-05-06
- **Milestone(s):** M-176
- **Branch:** claude/objective-sinoussi-77ae86
- **Commit(s):** TBD

---

## Goal

Replace the bare IndexTable on `BundlesListPage` with Polaris
`IndexFilters` so a merchant can:

- Search by title (live, debounced).
- Filter by status (draft / active / archived) and bundle type.
- Save the current filter set as a named view that persists
  across reloads.

Sets the IndexFilters chrome that M-177 (bulk actions), M-178
(sort + view modes), and M-179 (templates gallery) plug into.

## What was done

- **Spec written:**
  `docs/specs/M-176-bundle-list-indexfilters.md`.

- **Server** (`src/routes/settings.ts`):
  - New Zod schemas: `SavedViewFilters`, `SavedViewSort`,
    `SavedView`, `SavedViewsArray`.
  - `PatchSchema` accepts `savedViews?: SavedView[]`.
  - GET /settings exposes `savedViews` (default `[]`).
  - PUT /settings persists with whole-array replace
    semantics — the client owns ordering and partial CRUD
    would 4× the surface area for the merchant volume.
  - Validation: max 20 views/shop, label 1..40 chars,
    status enum bounded to `draft|active|archived` (no
    `deleted` — soft-deleted bundles aren't list-visible
    anyway), type enum bounded to `BUNDLE_TYPES`.

- **Frontend**
  (`frontend/src/components/bundlesList/BundlesListTable.tsx`,
  new file):
  - Wraps Polaris `IndexFilters` + `IndexTable` together.
  - Pure controlled-state component — page owns fetching and
    persistence.
  - Search input wired to `queryValue`. Status + Type chip
    filters via Polaris `ChoiceList` filter slots.
  - Tabs: built-in "All" + saved views from props.
    `canCreateNewView` opens Polaris's built-in save modal.
  - Delete confirmation modal for non-default tabs.
  - "Showing first N of M" footer when total exceeds rows
    (true pagination is M-178 territory).

- **`BundlesListPage`** refactored:
  - Manages filter state locally; debounces search 300ms
    before re-fetching `/api/v1/bundles?status=&type=&search=`.
  - Bumped `limit` to 100 on page-load fetch so filtered
    counts are accurate for typical merchants.
  - Stats strip now reflects the *filtered* result set; the
    "Total" tile relabels to "Filtered" when any filter is
    active.
  - Lazy-loads saved views from `/api/v1/settings` once on
    mount.
  - `handleSaveView`/`handleDeleteView` PATCH the whole
    `savedViews` array back; auto-selects the newly-saved
    view.
  - Editing filters drops you back into the All view (no
    surprise mutation of a saved view in place).
  - `FreshShopDashboard` rendering preserved for brand-new
    shops (no bundles + no filters active).

## Tests added

- `src/routes/settings.test.ts` (37 cases, +5):
  - GET exposes savedViews defaulting to `[]`.
  - PUT persists a valid savedViews array (whole-array
    replace).
  - PUT rejects savedView missing label.
  - PUT rejects > 20 savedViews.
  - PUT rejects savedView with unsupported status filter.

- `frontend/src/components/bundlesList/BundlesListTable.test.tsx`
  (new, 5 cases):
  - Renders bundle rows.
  - Renders saved-view tabs alongside the built-in All
    (using `getAllByText` because Polaris Tabs renders the
    same label in measurer + visible variants).
  - Renders the IndexFilters tablist chrome.
  - Footer renders for `total > rows.length`.
  - Row click fires `onRowClick` with the bundle id.

- `frontend/src/pages/BundlesListPage.test.tsx`
  (new, 3 cases):
  - FreshShopDashboard renders for a brand-new shop.
  - IndexFilters table renders when bundles exist.
  - Saved views are loaded from `/api/v1/settings` on mount.

## Acceptance criteria status

- [x] Compiles, lints clean (no new violations), 650/650
  vitest pass.
- [x] /bundles renders IndexFilters with status + type chips +
  search.
- [x] Saved views persist to `settings.savedViews` and round-
  trip across page reloads.
- [x] Stats strip reflects the filtered result set.
- [x] Existing fresh-shop / wizard / FreshShopDashboard
  layouts unchanged.

## Verified by hand

- `npx vitest run src/routes/settings.test.ts` → 37/37.
- `npx vitest run frontend/src/components/bundlesList/BundlesListTable.test.tsx`
  → 5/5.
- `npx vitest run frontend/src/pages/BundlesListPage.test.tsx`
  → 3/3.
- `npx vitest run` (full) → 650 passed, 13 skipped.
- `npm run typecheck` → clean.
- `npm run lint` → 6 pre-existing errors / 17 pre-existing
  warnings; no new violations.

## Deferred

- **True pagination** with a page cursor. Today the page
  loads `limit=100` and surfaces a "first N of M" footer
  when truncated. Real pagination lands with M-178's sort +
  view modes work.
- **Bulk actions** (publish many, archive many, delete
  many) — M-177.
- **Sort UI** in IndexFilters — paired with M-178's table /
  card / compact view modes.
- **Server-side full-text search** beyond `LIKE` — Postgres
  `to_tsvector` is a separate ticket if/when search becomes
  primary.
- **Sharing views** across shops or as templates — M-179.

## Notes

The IndexFilters API in Polaris 12 has matured enough that
`canCreateNewView` + `onCreateNewView` covers the entire save
flow without us building our own modal. We do still ship a
fallback save modal in `BundlesListTable.tsx` for explicit
"Save view" buttons callers can wire up — currently unused but
cheap to keep.

Filter state is owned by the page, not the table component.
That keeps the table render-testable in isolation (no fetch,
no router) and means M-177/M-178 can grow the filter shape
without touching table internals.

Saved views use whole-array replace semantics rather than
per-row CRUD endpoints. Trade-off: simpler server (+ fewer
routes to test), but two tabs open in different windows could
race-overwrite each other. Acceptable for the merchant volume
we expect — most shops have 1-2 admins. If race conditions
surface in beta we'll add a tiny `If-Match: <updatedAt>` header
or move to per-row CRUD.

The "Total" stat tile relabels to "Filtered" when filters are
active so the count never misleads the merchant about what
they're looking at. The unfiltered total is still accessible
via the IndexFilters footer and the IndexTable header.

Phase R3 progress: 1 of 4 done. M-177 (bulk actions) is next
and plugs into the IndexFilters chrome we just shipped — the
selectable=true switch + IndexFilters' built-in promoted
bulk-action slot.
