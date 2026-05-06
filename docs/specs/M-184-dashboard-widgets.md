# M-184 — Dashboard widgets on app home

- **Phase:** R5 (post-roadmap polish — net-new milestone)
- **Status:** spec
- **Depends on:** every prior R-phase milestone (data sources)
- **Followed by:** M-185 (settings left sidebar)

---

## Why

Today the app's home route `/` renders one of two screens:

1. The **fresh-shop** branch (`OnboardingWizard` + three differentiator
   cards) when the shop has never had bundles.
2. The **populated** branch — `BundlesListPage` with stat cards
   limited to bundle counts (Total / Active / Draft / Archived) and
   the IndexFilters-driven bundles table.

Neither surface answers the merchant's first daily question:
**"how is my store doing today?"** That's why merchants drill into
Analytics, Orders, Inventory, AI suggestions, A/B tests one by one.
A multi-domain dashboard at `/` collapses that round-trip into one
page.

## What ships

A new **DashboardPage** at `/`, with the existing `BundlesListPage`
moving to `/bundles`. The fresh-shop / wizard branch stays —
DashboardPage shows it when `total === 0 && !hasEverHadBundles`.

### Widgets (Polaris Cards in a Grid)

Each card is a Polaris `Card` with a headline number / sparkline /
short list and a "View all →" action. Eight widgets total, ordered
top→bottom for the most actionable signal first.

1. **Revenue strip** (full width)
   `GET /api/v1/analytics/overview?range=7d` (already exists, M-112).
   Three cells: Today / Last 7 days / Last 30 days.
   Action: View all → `/analytics`.

2. **Active bundles** (1/3 width)
   `GET /api/v1/bundles?status=active&limit=1` for total, plus
   `GET /api/v1/bundles?sortBy=updatedAt&sortOrder=desc&limit=3` to
   show the 3 most-recently-touched.
   Action: View all → `/bundles`.

3. **Top performing bundle** (1/3 width)
   `GET /api/v1/analytics/bundles?sortBy=revenue&limit=1`.
   Renders title + revenue + conversion-rate.
   Action: View all → `/bundles/:id` (link target uses the result row).

4. **Low-stock alerts** (1/3 width)
   `GET /api/v1/inventory/health?belowThreshold=true&limit=5`.
   Renders count headline + the 3 most critical SKUs.
   Action: View all → `/inventory`.

5. **Recent orders** (1/2 width)
   `GET /api/v1/orders?limit=5&sortBy=createdAt&sortOrder=desc`.
   Renders 5 most-recent orders with bundle title + total.
   Action: View all → `/orders`.

6. **Pending AI suggestions** (1/2 width)
   `GET /api/v1/ai/suggested-bundles?limit=3`.
   Renders count + top suggestion preview.
   Action: View all → `/ai-suggestions`.

7. **Active A/B tests** (1/2 width)
   `GET /api/v1/ab-tests?status=running&limit=3`.
   Renders count + leading variant per running test.
   Action: View all → `/ab-tests`.

8. **Recent activity** (1/2 width)
   `GET /api/v1/activity?limit=5` — **new aggregator route**,
   pulling from `bundle_activity_log` (M-174) across the shop's
   bundles. Inferred from existing per-bundle queries; reuses the
   activity repo.
   Action: View all → first bundle in the result, or no action if
   empty.

### Why an aggregator activity route is needed

`bundle_activity_log` today is queryable per-bundle
(`GET /api/v1/bundles/:id/activity`). The dashboard needs a
shop-wide newest-first feed. Cleanest implementation: new
`GET /api/v1/activity?limit=N` that runs the same `findMany` with
`where: { shopId }` instead of `where: { bundleId }`.

## File-level changes

### Frontend

- **New:** `frontend/src/pages/DashboardPage.tsx` — orchestrates
  parallel fetches, renders the eight widget cards, handles the
  fresh-shop branch by mounting the existing `OnboardingWizard` /
  `FreshShopDashboard` from BundlesListPage (extracted to
  `frontend/src/components/dashboard/FreshShopDashboard.tsx` so it's
  reusable).
- **New:** `frontend/src/components/dashboard/widgets/` — one file
  per widget (`RevenueStrip.tsx`, `ActiveBundlesCard.tsx`,
  `TopBundleCard.tsx`, `LowStockCard.tsx`, `RecentOrdersCard.tsx`,
  `PendingAiCard.tsx`, `AbTestsCard.tsx`, `RecentActivityCard.tsx`).
  Each is a self-contained Card that owns its own fetch + loading +
  empty state. Independent failure: one widget erroring shows a
  single error Banner inside its card; the rest keep rendering.
- **Modified:** `frontend/src/App.tsx` — route `/` now points at
  `DashboardPage`; new route `/bundles` points at `BundlesListPage`.
  Existing `/bundles/new` and `/bundles/:id` unchanged.
- **Modified:** `frontend/src/components/NavMenu.tsx` —
  `<a href="/">Dashboard</a>` (with `rel="home"`) and
  `<a href="/bundles">Bundles</a>` as the second entry.
- **Modified:** `frontend/src/pages/BundlesListPage.tsx` — extract
  `FreshShopDashboard` into its own file (zero behavior change). The
  fresh-shop branch in BundlesListPage stays — merchants who land on
  `/bundles` directly via deep-link still see the welcome surface
  the first time.

### Server

- **New:** `src/routes/activity.ts` — single route
  `GET /api/v1/activity?limit=N`, returns shop-wide
  `bundle_activity_log` rows newest-first, joined to bundle title.
  Caps `limit` at 50, defaults 10. Reuses
  `bundleActivityRepo.findShopWide()` (new method).
- **Modified:** `src/services/bundles/activityRepo.ts` — add
  `findShopWide({ shopId, limit })` method. ~10 LOC.
- **Modified:** `src/server/index.ts` — register new route.

## Acceptance criteria

- [ ] `npm run typecheck`, `npx vitest run`, `npm run lint` all
      pass at session close.
- [ ] `/` renders DashboardPage when shop has bundles. The eight
      widgets each render their content or a skeleton/empty state.
- [ ] `/bundles` renders BundlesListPage unchanged from today.
- [ ] NavMenu shows "Dashboard" first, "Bundles" second.
- [ ] Fresh-shop branch (`total === 0 && !hasEverHadBundles`) on
      `/` shows OnboardingWizard / FreshShopDashboard exactly as
      before.
- [ ] Each widget's "View all" link navigates to the correct page.
- [ ] One widget failing (mocked 500) shows an inline Banner in
      that card; the other seven still render.
- [ ] New `GET /api/v1/activity` route returns rows from
      `bundle_activity_log` filtered by `shopId`, capped at 50,
      newest-first.
- [ ] Tests:
  - Each widget has a vitest test rendering happy + empty + error
    states (8 widgets × ~3 cases ≈ 24 tests).
  - DashboardPage test asserts widget composition + fresh-shop
    branch.
  - `src/routes/activity.test.ts` — happy / limit-cap / cross-tenant
    scoping (3 cases).
  - `bundleActivityRepo.findShopWide` direct test (1 case).

## Out of scope (deferred)

- Real-time updates (websocket / SSE). Page refresh or back-button
  re-fetches; that's enough for v1.
- Per-merchant widget customization (drag-drop reorder, hide).
  Future R6 work.
- Sparkline rendering on the Revenue strip — first cut shows the
  three numbers; tiny SVG sparkline comes later. Polaris doesn't
  ship a sparkline, so this is a build-our-own thing not worth the
  scope right now.
- Re-skinning Analytics/Orders/Inventory pages to match the
  dashboard's information density. Those pages stay as they are.

## Risks

- **Eight parallel fetches on a cold load.** Mitigation: each
  widget owns its fetch and renders independently with a Skeleton
  placeholder. The page is interactive within the time of the
  fastest response, not the slowest.
- **The activity feed is new and not load-tested.** Mitigation: cap
  at 50 rows, query is `where shopId = ? order by createdAt desc
  limit N` against an indexed column.
- **NavMenu change is user-visible.** "Bundles" used to be home.
  Anyone with `rel="home"` muscle memory will land on Dashboard
  instead. That's the explicit intent — the spec is to elevate
  multi-domain visibility — but worth flagging.

## Followed by

M-185 — refactor SettingsPage internal navigation from horizontal
Tabs to a two-pane Polaris Layout with a vertical section list.
