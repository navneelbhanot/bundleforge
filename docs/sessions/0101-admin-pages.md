# Sessions 0101..0108 — admin pages

Server side:
- `src/services/orders/repository.ts` (new) — list + findById scoped
  by shopId.
- `src/routes/orders.ts` rewritten — `GET /` paginated, `GET /:id`
  detail. 3 supertest cases.
- `src/routes/settings.ts` rewritten — `GET /`, `PUT /` (Zod-validated
  patch merged into `Shop.settings`). 4 supertest cases.

Frontend:
- `frontend/src/components/PricingRulesEditor.tsx` (M-101) — Polaris
  IndexTable with add/remove. 2 RTL tests.
- `frontend/src/components/OnboardingWizard.tsx` (M-108) — 3-step
  wizard component.
- `frontend/src/pages/OrdersListPage.tsx` (M-102) — IndexTable over
  /api/v1/orders.
- `frontend/src/pages/OrderDetailPage.tsx` (M-103) — totals + SKU
  breakdown table.
- `frontend/src/pages/InventoryAuditPage.tsx` (M-104) — paginated
  audit trail.
- `frontend/src/pages/InventoryHealthPage.tsx` (M-105) — counts by
  sync status.
- `frontend/src/pages/SettingsPage.tsx` (M-106) — safety lock +
  notification toggles, PUT /settings.
- `frontend/src/pages/BillingPage.tsx` (M-107) — current plan +
  monthly/annual subscribe buttons.
- `frontend/src/App.tsx` updated with 8 new routes + nav links.

361 tests pass.
