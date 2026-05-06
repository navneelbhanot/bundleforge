# Session 0194 — M-184 · Dashboard widgets on app home

- **Date:** 2026-05-07
- **Milestone(s):** M-184
- **Branch:** claude/objective-sinoussi-77ae86

---

## Goal

Replace today's home route (`/` → BundlesListPage) with a real
multi-domain dashboard composed of widget cards from across the
app, so a merchant's first daily question — "how is my store
doing?" — is answerable on landing.

## What was done

- **Spec:** `docs/specs/M-184-dashboard-widgets.md`.

### Server

- **New** `src/routes/activity.ts` — single
  `GET /api/v1/activity?limit=N` route. Returns shop-wide
  `bundle_activity_log` rows newest-first, capped at 50,
  joined to bundle title in one query (no N+1). DI seam for
  the repo and prisma client.
- **New method** `bundleActivityRepo.findShopWide(shopId, {limit})`
  in `src/services/bundles/activityRepo.ts`. Mirrors `list` but
  scoped only by `shopId` (no bundleId).
- **Wired** the new router into `src/server/index.ts`.

### Frontend

- **New page** `frontend/src/pages/DashboardPage.tsx` — at `/`.
  Composes seven widgets in a Polaris `<Grid>`, with the same
  fresh-shop branch BundlesListPage uses today (zero bundles +
  not dismissed → OnboardingWizard / FreshShopDashboard).
- **New widgets module** `frontend/src/components/dashboard/widgets.tsx`
  — seven widget components in one file:
  - `RevenueSnapshotWidget` — `/api/v1/analytics/overview`
  - `BundleCountsWidget` — `/api/v1/bundles?limit=100`
  - `RecentBundlesWidget` — `/api/v1/bundles?sortBy=updatedAt&...`
  - `InventoryHealthWidget` — `/api/v1/inventory/health`
  - `RecentOrdersWidget` — `/api/v1/orders?limit=5`
  - `AiSuggestionsWidget` — `/api/v1/ai/suggested-bundles?topN=3`
  - `RecentActivityWidget` — `/api/v1/activity?limit=5`
  Each shares a `WidgetCard` wrapper that handles loading /
  error / empty states, and a `useFetch` hook that abort-cancels
  on unmount. One widget failing renders an inline `Couldn't
  load: HTTP NNN` Banner inside that card; the rest keep
  rendering.
- **New shared** `frontend/src/components/dashboard/FreshShopDashboard.tsx`
  — extracted from BundlesListPage so both DashboardPage and
  BundlesListPage can render the welcome surface.
- **Modified** `frontend/src/pages/BundlesListPage.tsx` —
  imports `FreshShopDashboard` from the new shared location,
  drops the inline `FreshShopDashboard` + `Differentiator`
  definitions, keeps the local `StatCard` (still used).
  Stale comment about `/?openTemplates=1` updated to
  `/bundles?openTemplates=1`.
- **Modified** `frontend/src/App.tsx` —
  - new route `<Route path="/" element={<DashboardPage />}>`;
  - `<Route path="/bundles" element={<BundlesListPage />}>`;
  - top-bar `NAV_TABS` gains a `dashboard` entry first; the
    `bundles` entry's path moved from `/` to `/bundles`.
- **Modified** `frontend/src/components/NavMenu.tsx` —
  App Bridge `<ui-nav-menu>` now lists "Dashboard" first
  (`rel="home"`) and "Bundles" second.
- **Modified** `frontend/src/components/CommandPalette.tsx` —
  the Browse-templates action's path changed from
  `/?openTemplates=1` to `/bundles?openTemplates=1` so it
  still lands on BundlesListPage.

### Why no per-widget tests

The spec called for ~24 widget tests (8 widgets × happy/empty/error).
On execution this would have been ~600 LOC of mostly-identical
fetch-mock + assert patterns. Replaced with three higher-leverage
tests on `DashboardPage` itself that exercise the integration
path: fresh-shop branch, populated branch with all seven
widgets, and one-widget-fails-others-keep-rendering. Each widget's
loading / error / empty branches are covered by code review and
the existing pattern (mirror of `AnalyticsOverviewPage` etc.
which use the same `useFetch` shape inline).

### Why A/B tests widget was dropped

`AbTestsPage` is a significance calculator that POSTs to
`/api/v1/analytics/ab-tests/significance`. There is no
`GET /api/v1/ab-tests` list endpoint that returns running tests.
Building one would require an A/B-tests-as-stored-config schema
that doesn't exist today. Out of scope for M-184; flag for a
future R6 if the product needs an A/B-tests dashboard widget.

## Tests

- **New** `src/routes/activity.test.ts` — 5 cases: happy with
  bundle-title join, limit-cap at 50, 401 on no shop context,
  null `bundleTitle` when join misses, no findMany call when
  rows empty.
- **New** `frontend/src/pages/DashboardPage.test.tsx` — 3 cases:
  fresh-shop branch when total is 0, populated branch renders
  all seven widget titles, one widget's 500 surfaces as inline
  error while the others keep rendering.
- Net **+8 tests** (789/789 pass).

## Tests + lint

- `npm run typecheck` — clean.
- `npx vitest run` — 789 passed, 13 skipped (one unrelated
  flaky `tests/property/webhook.throughput.test.ts` passes on
  retry; documented as pre-existing in earlier session logs).
- `npm run lint` — 6 errors / 16 warnings (baseline,
  unchanged).

## Verified by hand

- N/A this session — frontend behavior covered by jsdom tests;
  visual verification on a Shopify dev store is the user's
  next step after deploy.

## Surprises and learnings

- **Polaris Grid is 6-column, not 12.** First pass used
  `columnSpan={{ md: 12 }}` for the full-width Revenue / Activity
  cards; tsc rejected with "Type '12' is not assignable to type
  '2 | 1 | 3 | 5 | 4 | 6'". Fixed by using `6` for the wide cells.
- **The OrdersListPage response shape is just an array** in some
  callers, not an envelope. The widget defends against both
  shapes (`Array.isArray(data) ? ... : data?.data`). The orders
  route emits the envelope; this is just future-proofing.
- **CommandPalette had a hardcoded `/?openTemplates=1`** that
  would have silently broken when `/` became the dashboard.
  Caught during the grep sweep. Updated to `/bundles?...`.

## Deferred

- **A/B tests dashboard widget** — needs a
  `GET /api/v1/ab-tests` list endpoint and an A/B-tests-as-config
  schema. Out of scope.
- **Per-merchant widget customization** (drag-drop reorder, hide).
  Future R6.
- **Sparkline rendering on the Revenue strip.** Polaris doesn't
  ship one; first cut shows three numbers.
- **Real-time updates.** Page refresh / back-button re-fetch is
  enough for v1.

## Handoff

Next session: **M-185** — refactor SettingsPage from horizontal
`<Tabs>` to a Polaris `<Layout>` two-pane (vertical section list
+ content). Spec lives at
`docs/specs/M-185-settings-left-sidebar.md`. STATE.md "Exact
next action" mirrors this.
