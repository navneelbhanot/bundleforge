# M-176 — Bundle list · IndexFilters + saved views

> First milestone of Phase R3 (`docs/plans/rich-admin-ui-roadmap.md`).
> Replaces the bare `IndexTable` on `BundlesListPage` with
> Polaris `IndexFilters`: live search, status / type filter
> chips, and persistent "saved views" so a merchant who lives
> in "Active drafts only" doesn't have to reset on page reload.

---

## Why

Today the bundle list shows every bundle in creation order with
no filtering at all. The first 20 rows come back from
`/api/v1/bundles` because the API paginates, and the page
silently drops anything past page 1. A merchant with 30+
bundles can't find a specific one without scrolling, and a
team-managed shop has no way to save the queries they run
weekly ("show me drafts I haven't published yet").

Polaris `IndexFilters` gives all of this with one component.
We need to:

1. Filter on the server side (search, status, type already
   wired in `service.list()`).
2. Persist saved views per-shop so they survive reload + are
   shared across team members logged into the same admin.

Phase R3's other milestones (M-177 bulk actions, M-178 sort +
view modes, M-179 templates gallery) plug into the IndexFilters
shell M-176 introduces.

---

## Scope

### Server — saved views as a settings sub-object

No new schema column. Saved views live under
`Shop.settings.savedViews` (the `settings` JSON column has been
the catch-all since M-001).

Stored shape:
```jsonc
{
  "savedViews": [
    {
      "id": "view-uuid",
      "label": "Active drafts",
      "filters": {
        "status": "draft",
        "type": "build_box",
        "search": ""
      },
      "sort": { "sortBy": "createdAt", "sortOrder": "desc" }
    }
  ]
}
```

All fields except `id` and `label` optional. Empty `filters`
means "no filter applied" (the All view).

Routes:
- `GET /api/v1/settings` already returns `settings` — extend the
  shape to surface `savedViews: SavedView[]` (defaulting to `[]`).
- `PATCH /api/v1/settings` already accepts a `settings` patch —
  extend `PatchSchema` to include `savedViews` as an array of
  validated view objects. Whole-array replace semantics (saving
  one view overwrites the entire `savedViews` list) — the
  client is the source of truth for ordering and easier than
  per-row CRUD for the merchant volume we expect.

Validation:
- Max 20 saved views per shop (UI listing space).
- `id` non-empty string.
- `label` 1..40 chars (matches Polaris tab label width).
- `filters.status` one of `draft|active|archived` (no
  `deleted` — soft-deleted bundles aren't list-visible
  anyway).
- `filters.type` one of `BUNDLE_TYPES` (re-import from
  `services/bundles/validators`).
- `filters.search` ≤ 200 chars.
- `sort.sortBy` one of `createdAt|updatedAt|title|priority`
  (matches the server's existing `ALLOWED_SORT_BY`).
- `sort.sortOrder` one of `asc|desc`.

### Frontend

New component
`frontend/src/components/bundlesList/BundlesListTable.tsx`:
- Wraps Polaris `IndexFilters` + `IndexTable` together.
- Props: `bundles`, `pagination`, `filters`, `views`,
  `selectedView`, `onFilterChange`, `onViewSelect`,
  `onSaveView`, `onDeleteView`.
- Filter chips: status (Select-style chip choices), type
  (Select-style chip choices). Search input wired to the
  `queryValue` prop.
- View tabs at top of IndexFilters via the `tabs` prop. First
  tab is always "All" (built-in, not stored). Custom views
  follow.
- "Save view" action in the tab strip opens a small Modal
  asking for a label; on submit calls `onSaveView(label,
  filters, sort)` which persists via PATCH /settings and
  re-fetches the views list.
- "Delete view" action on each non-default tab opens a
  confirm dialog; calls `onDeleteView(id)`.

Refactor `BundlesListPage`:
- Lazy-fetch shop settings once (mirrors the M-171 Display
  tab pattern — fetch `/api/v1/settings` after load).
- Manage filter state locally; debounce search (300ms) before
  re-fetching `/api/v1/bundles?status=&type=&search=`.
- Bump the page-load `limit` to 100 (max the API allows) so
  filtered counts are accurate for typical merchants. Add a
  small "Showing first 100 of N" footer when `total > 100`.
  True pagination lands in M-178 (sort + view modes).
- Keep the 4-stat strip — but compute stats from the *current
  filtered* result set so it matches what the merchant is
  looking at.

### Tests

- `src/routes/settings.test.ts` (+3):
  - PATCH with valid `savedViews` persists.
  - PATCH rejects savedView without an `id` or `label`.
  - PATCH rejects > 20 savedViews.
- `frontend/src/components/bundlesList/BundlesListTable.test.tsx`
  (new, 4 cases):
  - Renders header tabs + table rows.
  - Typing in search calls `onFilterChange`.
  - Selecting a saved view calls `onViewSelect`.
  - Clicking Save view opens the modal + submits with a label.
- `frontend/src/pages/BundlesListPage.test.tsx` (+1):
  - Existing tests still pass (the page contract for fresh
    shop / wizard is unchanged).
  - New: with non-empty rows, the IndexFilters search input is
    visible and typing fires a re-fetch.

---

## Acceptance criteria

- [x] Compiles, lints clean (no new violations), all vitest pass.
- [x] /bundles renders IndexFilters with status + type chips +
  search.
- [x] Saved views persist to `settings.savedViews` and round-
  trip across page reloads.
- [x] Stats strip reflects the *filtered* result set.
- [x] Existing fresh-shop / wizard / FreshShopDashboard layouts
  unchanged.

---

## Out of scope (deferred)

- **True pagination** with a "next page" cursor. Today the page
  bumps `limit=100` and surfaces a "first 100 of N" hint when
  truncated. Real pagination is M-178's territory.
- **Bulk actions** (publish many, archive many, delete many) —
  M-177.
- **Sort UI** — IndexFilters has a sort prop we'll wire in
  M-178 along with view modes (table / card / compact).
- **Server-side full-text search** beyond the
  `where.title.contains` substring match. Postgres `to_tsvector`
  upgrade is its own ticket if/when search becomes a primary
  workflow.
- **Sharing views across shops** (template gallery) — M-179.
