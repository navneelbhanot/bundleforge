# M-178 — Bundle list · sort + view modes + true pagination

> Third milestone of Phase R3 (`docs/plans/rich-admin-ui-roadmap.md`).
> Wires sort + view-mode toggles into the IndexFilters chrome
> from M-176, replaces today's `limit=100` truncation footer
> with a real `Pagination` cursor, and extends saved views to
> persist sort + view mode alongside filters.

---

## Why

After M-176/M-177:

- The list paginates server-side but the page only loads the
  first 100 rows and shows a "Showing first N of M" footer
  when truncated. A merchant with 200 bundles can't reach the
  101st without writing a filter that narrows it.
- There's no sort UI — every list is `createdAt DESC` because
  that's the server default. Title-sort and priority-sort exist
  in `service.list()` (added in M-049) but no surface uses
  them.
- Power users on small screens want a denser layout.
  Merchants using the list as a "what does this bundle look
  like" reference want a card grid with the bundle title +
  status + type + a quick action.

This milestone closes those three gaps in one shot — they
share state (sort, view mode, page cursor) and persistence
(saved views).

---

## Scope

### Server

`SavedView` schema (in `src/routes/settings.ts`):
- Add `viewMode?: "table" | "compact" | "card"`. Defaults
  to `table` when absent.

No other server changes. The list endpoint already accepts
`sortBy`, `sortOrder`, `page`, `limit`. The bundle service's
`ALLOWED_SORT_BY` set already covers the four fields the UI
exposes.

### Frontend — sort

`BundlesListTable.tsx`:
- New `sortOptions` array passed to `IndexFilters`:
  - Newest first (`createdAt desc`)
  - Oldest first (`createdAt asc`)
  - Recently updated (`updatedAt desc`)
  - Title A → Z (`title asc`)
  - Title Z → A (`title desc`)
  - Priority high → low (`priority desc`)
- Wire `sortSelected` + `onSort` to controlled state owned by
  the page.

### Frontend — pagination

`BundlesListPage.tsx`:
- Drop `PAGE_LIMIT = 100` truncation footer behavior.
- New `page` state (defaults to 1) + `PAGE_SIZE = 20` (matches
  the API's natural page size).
- Re-fetch on `(filters, sort, page)` change; resetting
  filters / sort returns to page 1.
- Polaris `Pagination` rendered below the table — driven by
  `pagination.hasNext` + `pagination.hasPrev` from the server
  response.
- Keep the existing total-count surface but rephrase as
  "Page N of M, K bundles total" when paginated.

### Frontend — view modes

New view-mode toggle above the table (small Polaris
`ButtonGroup` with three icon buttons: Table, Compact, Card).
- **Table** (default) — current `IndexTable` rendering with
  full columns.
- **Compact** — same `IndexTable` with `condensed={true}`
  prop. Tighter rows, same columns.
- **Card** — Polaris `Grid` of `Card` items. Each card
  shows: title (heading), status badge, type, Edit button.
  No images (the list endpoint doesn't return image URLs;
  loading them would be a per-row Shopify Admin GraphQL fan-
  out — out of scope).
  Selection still works via a checkbox in the card corner.

Card mode keeps the M-177 bulk action toolbar functional —
`useIndexResourceState` is independent of the rendering mode.
The selectable header / per-card checkboxes wire to the same
`selectedResources` state.

### Saved views — persist sort + viewMode

`BundlesListPage.tsx`:
- `handleSaveView(label)` writes the *current* sort + view
  mode into the new view alongside filters.
- `handleViewSelect(index)` restores filters + sort + view
  mode from the chosen view.
- Editing any of (filters, sort, view mode) drops you back
  into the All view (matches M-176's filter-edits-drop-view
  behavior).

### Tests

- `src/routes/settings.test.ts` (+1):
  - PUT savedViews accepts `viewMode` and rejects an
    unknown value.

- `frontend/src/components/bundlesList/BundlesListTable.test.tsx`
  (+2):
  - Sort options array reaches `IndexFilters`.
  - Card-view toggle: clicking the Card mode button renders
    the Polaris `Grid` instead of `IndexTable`.

- `frontend/src/pages/BundlesListPage.test.tsx` (+2):
  - Sort selection re-fetches with the new `?sortBy=&sortOrder=`.
  - Pagination Next click re-fetches with `?page=2`.

---

## Acceptance criteria

- [x] Compiles, lints clean (no new violations), all vitest
  pass.
- [x] /bundles renders the IndexFilters sort dropdown with
  6 options.
- [x] Card view renders without breaking selection or bulk
  actions.
- [x] Real pagination replaces the truncation footer.
- [x] Saved views round-trip filters + sort + view mode.

---

## Out of scope (deferred)

- **Bundle list images** in card view — would require a
  per-row Shopify Admin GraphQL fan-out or a
  `image_url` denormalisation on Bundle. Wait for a merchant
  ask.
- **Drag-to-reorder priority** — possible future card-view
  affordance, but `priority` already drives sort and is
  editable on the Bundle Detail page.
- **Cursor-based pagination** (vs offset). Offset works fine
  at our scale; a cursor saves keystrokes when bundles are
  measured in the tens of thousands.
- **Density preference at the user level** (vs per-saved-view).
  Saved views own this for now — a user who wants compact
  globally can save an "All compact" view.
- **Templates / preset gallery** — M-179.
