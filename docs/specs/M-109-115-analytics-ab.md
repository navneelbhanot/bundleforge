# M-109..M-115 — Analytics + A/B testing

## M-109 Analytics ingestion

`POST /api/v1/analytics/events` accepts a batch of events and persists
to `analytics_events`. Theme-extension JS calls this with `view`,
`add_to_cart`, `purchase` events.

## M-110 Rollup queries

Aggregations expressed as Prisma queries. No materialized views yet —
`groupBy` is fine at the volumes we'll see in Phase 1.

## M-111 Overview endpoint + dashboard

`GET /api/v1/analytics/overview` returns total revenue, total bundle
orders, AOV, and a top-bundles list. Frontend `AnalyticsOverviewPage`
renders Polaris Card stats.

## M-112 Per-bundle analytics

`GET /api/v1/analytics/bundles/:id` returns the per-bundle breakdown.

## M-113 A/B test service

`abTestService.ensureAssignment(test, sessionId)` deterministically
maps a session id to A or B based on a hash + the test's
`trafficSplit`. Pure function plus a small persistence helper.

## M-114 A/B routes + UI

CRUD-ish routes under `/api/v1/analytics/ab-tests` and a Polaris page
listing tests + simple variant comparison.

## M-115 A/B significance calculator

Pure two-proportion z-test. Returns `{p, significant, winner}`.

## Files

- `src/services/analytics/repository.ts`
- `src/services/analytics/index.ts`     (rewrite stub)
- `src/services/analytics/abTest.ts`    (assign + significance)
- `src/services/analytics/abTest.test.ts`
- `src/routes/analytics.ts`             (rewrite stub)
- `src/routes/analytics.test.ts`
- `frontend/src/pages/AnalyticsOverviewPage.tsx`
- `frontend/src/pages/AbTestsPage.tsx`
