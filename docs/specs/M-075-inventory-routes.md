# M-075 — Inventory routes

`/api/v1/inventory` endpoints (per ARCHITECTURE.md §5.2):

- `GET /audit` — paginated audit trail.
- `POST /sync` — force manual inventory sync (no-op stub today; actual
  Shopify Inventory API call lands later as part of M-080+).
- `GET /health` — counts of synced/pending/error/locked rows for the shop.

Tenant safety via M-019 `req.shopId`.

## Files

- `src/routes/inventory.ts` (rewrite stub)
- `src/routes/inventory.test.ts`
