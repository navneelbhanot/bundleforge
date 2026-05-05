# M-053 — Bundle routes

## Endpoints (per ARCHITECTURE §5.1)

- `GET    /api/v1/bundles`           list (paginated, filterable)
- `POST   /api/v1/bundles`           create
- `GET    /api/v1/bundles/:id`       detail
- `PUT    /api/v1/bundles/:id`       update
- `DELETE /api/v1/bundles/:id`       soft delete
- `POST   /api/v1/bundles/:id/duplicate`
- `POST   /api/v1/bundles/:id/publish`
- `POST   /api/v1/bundles/:id/archive`
- `POST   /api/v1/bundles/import`    deferred to M-069

## Acceptance

- [ ] `installBundleRoutes(deps?)` factory + default singleton.
- [ ] Routes call BundleService; errors flow to M-007 errorHandler.
- [ ] `req.shopId` required (provided by upstream M-019).
- [ ] tsconfig exclude removes routes/bundles.ts.
- [ ] supertest cases (12+) cover happy paths + 404/400.
