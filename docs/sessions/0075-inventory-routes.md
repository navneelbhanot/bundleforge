# Session 0075 — Inventory routes

`src/routes/inventory.ts` rewritten as `installInventoryRoutes(deps?)`
factory + default singleton. Endpoints: `GET /audit` (paginated trail,
limit clamped to 200), `GET /health` (counts of sync states by status),
`POST /sync` (202 acknowledge — workers do the actual sync). 4 supertest
cases. 300 tests pass.
