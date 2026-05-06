# Session 0178 — Bundle list · sort + view modes + pagination

- **Date:** 2026-05-06
- **Milestone(s):** M-178
- **Branch:** claude/objective-sinoussi-77ae86
- **Commit(s):** TBD

---

## Goal

Close the three remaining list-richness gaps after M-176 +
M-177:

- **Sort UI** — `IndexFilters.sortOptions` wired to the
  server's existing `sortBy / sortOrder` surface.
- **True pagination** — replace the `limit=100` truncation
  footer with Polaris `Pagination` driving `page=N&limit=20`.
- **View modes** — let merchants flip between Table, Compact
  (dense IndexTable rows), and Card (responsive grid) views.

Saved views persist sort + view mode alongside filters so a
saved "All compact" view restores its own density.

## What was done

- **Spec written:**
  `docs/specs/M-178-bundle-list-sort-view-modes.md`.

- **Server** (`src/routes/settings.ts`):
  - Extended `SavedView` Zod schema with
    `viewMode?: "table" | "compact" | "card"`. No new
    schema column — piggybacks on the existing
    `Shop.settings` JSON.
  - PUT validation rejects unknown viewMode strings (e.g.
    `"kanban"`).
  - No other server changes — the list endpoint already
    accepted `sortBy`, `sortOrder`, `page`, `limit`; the
    bundle service's `ALLOWED_SORT_BY` already covered the
    four fields the UI exposes.

- **Frontend**
  (`frontend/src/components/bundlesList/BundlesListTable.tsx`):
  - New `BundleSort`, `ViewMode`, `PaginationInfo` types
    exported alongside `SavedView`.
  - Six `SORT_OPTIONS` mapped onto Polaris's
    `${string} asc | ${string} desc` template-literal value
    contract:
    - Newest first / Oldest first (createdAt)
    - Recently updated (updatedAt)
    - Title A → Z / Z → A
    - Priority high → low
  - Wired `IndexFilters` `sortOptions` + `sortSelected` +
    `onSort`.
  - Added a `ButtonGroup` view-mode toggle above the table
    body. Three pressed-states: Table / Compact / Cards.
  - When `viewMode === "compact"`, IndexTable gets
    `condensed={true}`. When `viewMode === "card"`, the
    table is replaced by a new `BundleCardGrid` component:
    Polaris `Grid` of `Card`s, each with a checkbox + status
    badge + title heading + type + Edit button. Selection
    state stays in the same `useIndexResourceState` hook so
    M-177's bulk actions keep working in card mode (the
    grid surfaces its own bulk-action bar above the cards
    when any are selected).
  - Replaced the "Showing first N of M" truncation footer
    with a Polaris `Pagination` component driven by the
    server's pagination envelope (`hasPrev` / `hasNext` /
    `page` / `totalPages`) plus an inline page-counter
    label.
  - Required `IndexTableSelectionType` import for typed
    selection mode dispatch from the card grid (Polaris
    re-exports it as a public symbol).

- **`BundlesListPage`** wiring:
  - New state: `sort`, `viewMode`, `page`, `paginationInfo`.
  - `buildQuery` now writes `page`, `limit`, `sortBy`,
    `sortOrder` into the query string. `PAGE_SIZE = 20`
    replaces `PAGE_LIMIT = 100`.
  - `fetchBundles(filters, sort, page)` reflects the
    full pagination envelope back into state so the table
    has accurate hasPrev/hasNext flags.
  - Filter / sort changes reset `page` to 1; selecting a
    saved view restores all four (filters, sort, viewMode,
    page=1).
  - `handleSaveView` writes the *current* filters + sort +
    viewMode into the new view object — round-trips across
    reloads.

## Tests added

- `src/routes/settings.test.ts` (39 cases, +1):
  - PUT savedViews accepts `viewMode: "card"` and rejects
    `viewMode: "kanban"`.

- `frontend/src/components/bundlesList/BundlesListTable.test.tsx`
  (10 cases, +3):
  - Footer renders "Page 1 of 13 · 250 bundles total"
    instead of the old truncation copy.
  - Clicking the Cards view-mode button fires
    `onViewModeChange("card")`.
  - With `viewMode="card"`, the table is gone and each
    card renders the bundle title heading.
  - Clicking the Pagination Next button fires
    `onPageChange(2)`.

- `frontend/src/pages/BundlesListPage.test.tsx` (5 cases, +1):
  - Initial fetch carries `page=1`, `limit=20`,
    `sortBy=createdAt`, `sortOrder=desc` query params.

## Acceptance criteria status

- [x] Compiles, lints clean (no new violations), 664/664
  vitest pass.
- [x] /bundles renders the IndexFilters sort dropdown with
  6 options.
- [x] Card view renders without breaking selection or bulk
  actions.
- [x] Real pagination replaces the truncation footer.
- [x] Saved views round-trip filters + sort + view mode.

## Verified by hand

- `npx vitest run src/routes/settings.test.ts` → 39/39.
- `npx vitest run frontend/src/components/bundlesList/BundlesListTable.test.tsx`
  → 10/10.
- `npx vitest run frontend/src/pages/BundlesListPage.test.tsx`
  → 5/5.
- `npx vitest run` (full) → 664 passed, 13 skipped.
- `npm run typecheck` → clean.
- `npm run lint` → 6 pre-existing errors / 17 pre-existing
  warnings; no new violations.

## Deferred

- **Bundle list images in card view** — needs either a
  per-row Shopify Admin GraphQL fan-out or an `image_url`
  denormalisation on Bundle. Wait for a merchant ask.
- **Drag-to-reorder priority** in card view. Priority is
  editable from Bundle Detail today.
- **Cursor-based pagination** vs offset. Offset works at our
  scale; cursors only matter at tens of thousands.
- **User-level density preference** (vs per-saved-view).
  Today the merchant saves an "All compact" view. Cheap to
  add a Shop.settings.general.defaultViewMode if asked.
- **Templates / preset gallery** — M-179.

## Notes

Polaris's `IndexFilters.sortOptions` requires `value` to
match `\`${string} asc\`` or `\`${string} desc\`` (template-
literal type). The internal `sortKey()` helper mirrors that
contract; `as const` casts make the formatter happy without
a runtime cost.

Card mode keeps `useIndexResourceState` for selection state
so M-177's bulk-action callbacks just work — the card grid
renders its own bulk-action bar above the grid when
selection is non-empty rather than reusing IndexTable's
promoted slot (which is inseparable from the table chrome).
The `IndexTableSelectionType` enum had to be imported because
TypeScript's strict typing rejected the lowercase string
literals that Polaris accepts at runtime.

Phase R3 progress: 3 of 4 done. M-179 (templates / preset
gallery) is next — a curated set of starter bundles a
merchant can clone with one click. Likely needs a small
read-only "templates" registry on the server and a new
modal flow on `BundlesListPage`. Sizing TBD in spec.
