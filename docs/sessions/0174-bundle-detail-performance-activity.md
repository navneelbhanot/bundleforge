# Session 0174 — Bundle Detail · Performance + Activity log tabs

- **Date:** 2026-05-06
- **Milestone(s):** M-174
- **Branch:** claude/objective-sinoussi-77ae86
- **Commit(s):** TBD

---

## Goal

Populate the two remaining read-only Phase R2 tabs:

- **Performance** — KPIs from `/api/v1/analytics/bundles/:id`
  (M-112), shipped but never surfaced anywhere.
- **Activity log** — paginated trail of admin actions on a
  bundle (publish, archive, save) so a merchant managing 50+
  bundles can answer "what changed and when".

## What was done

- **Spec written:**
  `docs/specs/M-174-bundle-detail-performance-activity.md`.

- **Prisma schema** (`prisma/schema.prisma`):
  - New `BundleActivityLog` model: `id`, `shopId`, `bundleId`,
    `action`, `summary`, `metadata` JSON, `createdAt`. Indexed
    on `(shopId, bundleId, createdAt DESC)`.
  - Cascade on Shop + Bundle delete (matches the relaxed
    posture for `inventory_audit_log` — see ADR-0003a).
  - Migration:
    `prisma/migrations/20260506240000_bundle_activity_log/`
    — NOT applied per CLAUDE.md §5.

- **Repository** (`src/services/bundles/activityRepo.ts`, new):
  - `append({ shopId, bundleId, action, summary, metadata? })`.
  - `list(shopId, bundleId, { page, limit })` returns
    `{ data, total }` ordered by `createdAt DESC`.
  - Append-only by convention — no update/delete methods.

- **Service** (`src/services/bundles/index.ts`):
  - New `logActivity()` helper wraps every `append` in a
    try/catch — a logging hiccup never propagates to the
    underlying mutation.
  - `publish()` → `published`.
  - `archive()` → `archived`.
  - `softDelete()` → `deleted`.
  - `update()` writes one entry per "section" in the patch:
    `details_updated`, `items_updated`, `pricing_updated`,
    `schedule_updated`, `display_updated`, `eligibility_updated`,
    `inventory_rules_updated`. Multiple keys in a single PUT
    produce multiple rows so the timeline reads naturally.

- **Route** (`src/routes/bundles.ts`):
  - New `GET /:id/activity?page=&limit=` returns
    `{ data, pagination }`.
  - Calls `service.getById` first to confirm the bundle is in
    this shop (404 otherwise) before exposing log rows.
  - Page clamped to `>=1`, limit clamped to `1..100`.
  - `installBundleRoutes` accepts an optional `activityRepo`
    for DI in tests.

- **Frontend** (`frontend/src/components/bundleDetail/`):
  - `PerformanceTab.tsx` (new): fetches
    `/api/v1/analytics/bundles/:id` lazily on mount, renders
    KPI strip (Views, Add-to-cart, Purchases, Revenue,
    Conversion rate, AOV) + a small per-event-type breakdown.
    Empty state when all event counts are 0. Critical Banner on
    fetch failure.
  - `ActivityTab.tsx` (new): paginated list with
    Polaris `Pagination`. Each row: action badge with tone-aware
    color (success / warning / info / critical), summary text,
    relative timestamp (e.g. "2h ago") with absolute time on
    hover. Empty state for newly created bundles.
  - Both expose a `fetcher` prop so tests can inject responses
    without the global fetch stub.

- **BundleDetailPage** wiring:
  - Added `<PerformanceTab>` and `<ActivityTab>` branches.
  - Updated placeholder fallback to exclude `performance` and
    `activity` (now Advanced is the only placeholder, M-175).

## Tests added

- `src/services/bundles/index.test.ts` (42 cases, +4):
  - `publish()` appends a `published` entry.
  - `archive()` appends an `archived` entry.
  - `update({ displaySettings, eligibility })` appends two
    entries.
  - Logging failure does not propagate.

- `src/routes/bundles.test.ts` (12 cases, +3):
  - GET activity returns paginated rows.
  - Respects `?page=` + `?limit=`.
  - 404 when bundle is not in this shop.

- `frontend/src/components/bundleDetail/PerformanceTab.test.tsx`
  (new, 3 cases):
  - Empty state when all event counts are zero.
  - Renders KPI numbers from a populated response.
  - Computes conversion rate as `purchases / views`.

- `frontend/src/components/bundleDetail/ActivityTab.test.tsx`
  (new, 3 cases):
  - Empty state when the server returns `data: []`.
  - Renders one row per activity entry.
  - Clicking Next refetches with `page=2`.

- `frontend/src/pages/BundleDetailPage.test.tsx` (10 cases, +2):
  - `#performance` deep-link asserts the tab is wired (lands
    on its empty state with the shared mockFetch fixture).
  - `#activity` deep-link asserts the same.
  - Updated placeholder regression to `#advanced` / M-175.
  - Updated "switching tabs preserves dirty title" to use
    `#advanced` (the only remaining placeholder).

## Acceptance criteria status

- [x] Compiles, lints clean (no new violations), 629/629 vitest pass.
- [x] /bundles/:id#performance renders KPIs from analytics.
- [x] /bundles/:id#activity renders paginated list.
- [x] publish / archive / update write activity rows.
- [x] Logging failure doesn't fail the underlying mutation.

## Verified by hand

- `npx vitest run src/services/bundles/index.test.ts` → 42/42.
- `npx vitest run src/routes/bundles.test.ts` → 12/12.
- `npx vitest run frontend/src/components/bundleDetail/PerformanceTab.test.tsx`
  → 3/3.
- `npx vitest run frontend/src/components/bundleDetail/ActivityTab.test.tsx`
  → 3/3.
- `npx vitest run frontend/src/pages/BundleDetailPage.test.tsx`
  → 10/10.
- `npx vitest run` (full) → 629 passed, 13 skipped.
- `npm run typecheck` → clean.
- `npm run lint` → 6 pre-existing errors only; no new
  violations from M-174.

## Deferred

- **Per-field diffs** in the activity log. Today's entries
  identify the section that changed; the structured
  `metadata` JSON column carries enough hints (e.g.
  items_updated logs `count`) for a future "Title changed
  from X to Y" view, but no UI exposes it yet.
- **Actor identity**. Sessions carry shop, not the human who
  clicked Save. Once the Shopify collaborator API exposes a
  stable user id we'll thread it through.
- **CSV / JSON export** of the activity log — useful for
  compliance reviews, no merchant has asked.
- **Date-range filters** on Performance — the analytics
  endpoint returns all-time totals today. Filters land when
  the shop-level Analytics page gets the same treatment.
- **Per-day revenue series chart** — would need a new
  `/analytics/bundles/:id/timeseries` endpoint. Skipped for
  initial ship.

## Notes

The activity log writer is intentionally fire-and-await rather
than fire-and-forget. We `await logActivity(...)` so the call
order is deterministic in tests, but the helper itself swallows
errors so the underlying `bundleRepo.update()` result is never
poisoned. This matches the `tagsAdd` pattern from the
`orders/create` webhook handler — log failures don't fail the
business operation.

The `activityRepo` is wired into the route via DI rather than
imported directly so tests can stub it without mocking
prisma. The service path uses the production repo; mocking it
in service tests requires a `vi.mock("./activityRepo", ...)`.

`InlineGrid` is the Polaris primitive for the KPI tile layout —
responsive 2/4 columns by breakpoint. It collapses cleanly on
the sidebar-flanked Bundle Detail page.

The `ACTION_TONE` map in `ActivityTab.tsx` is the only place
where action strings are duplicated frontend-side. If the
server's action enum grows we'll need to keep that synced or
share types via a generated client. Acceptable today because
"published / archived / *_updated" is a small, slow-moving set.

Phase R2 is now 6 of 7 done. M-175 (Advanced tab) is the only
remaining tab. After that, Phase R2 closes and we move to
Phase R3 (Bundle List richness — IndexFilters, bulk actions,
sort modes, templates).
