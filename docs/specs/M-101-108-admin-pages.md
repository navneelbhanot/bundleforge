# M-101..M-108 — Admin frontend completion

Round out the admin SPA. Each milestone is a focused page or component:

- **M-101 PricingRulesEditor** — DataTable of rule rows with inline
  add/delete; emits `onChange(rules)`. Wired into BundleDetailPage.
- **M-102 OrdersListPage** — `/api/v1/orders` list (route + page).
- **M-103 OrderDetailPage** — `/api/v1/orders/:id` detail view incl.
  SKU breakdown.
- **M-104 InventoryAuditPage** — paginated `GET /inventory/audit`.
- **M-105 InventoryHealthDashboard** — counts from `GET /inventory/health`.
- **M-106 SettingsPage** — safety-lock toggle (writes
  `Shop.settings.safetyLock`).
- **M-107 BillingPage upgrade** — current plan + subscribe buttons
  for growth/pro/enterprise.
- **M-108 OnboardingWizard** — multi-step component shown to fresh
  shops at /.

## Server-side additions

- `GET /api/v1/orders` — paginated `BundleOrder` listing.
- `GET /api/v1/orders/:id` — single order with sku breakdown.
- `PUT /api/v1/settings` — patch `Shop.settings.safetyLock`.

## Files

- `src/services/orders/repository.ts`, `src/services/orders/index.ts`
- `src/routes/orders.ts` (rewrite stub)
- `src/routes/orders.test.ts`
- `src/routes/settings.ts` (rewrite stub)
- `src/routes/settings.test.ts`
- `frontend/src/components/PricingRulesEditor.tsx` + test
- `frontend/src/pages/OrdersListPage.tsx` (replace stub)
- `frontend/src/pages/OrderDetailPage.tsx`
- `frontend/src/pages/InventoryAuditPage.tsx`
- `frontend/src/pages/InventoryHealthPage.tsx`
- `frontend/src/pages/SettingsPage.tsx` (replace stub)
- `frontend/src/pages/BillingPage.tsx` (upgrade)
- `frontend/src/components/OnboardingWizard.tsx`
- `frontend/src/App.tsx` — new routes
