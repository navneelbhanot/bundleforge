# Session 0053 — bundle routes

`src/routes/bundles.ts` rewritten as `installBundleRoutes(deps?)`
factory + default singleton. Endpoints: GET /, POST /, GET /:id,
PUT /:id, DELETE /:id, POST /:id/duplicate, POST /:id/publish, POST
/:id/archive. Auth gate via `req.shopId` (UnauthorizedError if missing).
Mounted in `src/server/index.ts` at `/api/v1/bundles`. **Removed
`src/routes/bundles.ts` from tsconfig exclude — second M-001 carry-over
cleared, no exclusions remain.** 9 supertest cases. 244 tests pass.
