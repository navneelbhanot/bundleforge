# Sessions 0109..0115 — analytics + A/B

Server:
- `src/services/analytics/repository.ts` — `ingest(events)`,
  `overview(shopId)`, `byBundle(shopId, bundleId)`. Uses Prisma
  `groupBy` + `aggregate`.
- `src/services/analytics/index.ts` — thin AnalyticsService class.
- `src/services/analytics/abTest.ts` (M-113, M-115) —
  `assign({sessionId, trafficSplit})` deterministic via
  SHA-256 of sessionId; `significance(a, b)` two-proportion z-test
  with Abramowitz & Stegun normal CDF approximation. 11 unit tests.
- `src/routes/analytics.ts` rewritten — POST `/events` (Zod-validated
  batch), GET `/overview`, GET `/bundles/:id`, POST
  `/ab-tests/significance`. 6 supertest cases.

Frontend:
- `frontend/src/pages/AnalyticsOverviewPage.tsx` (M-111) — totals +
  top bundles via /overview.
- `frontend/src/pages/AbTestsPage.tsx` (M-114) — significance
  calculator UI calling the route.

376 tests pass.
