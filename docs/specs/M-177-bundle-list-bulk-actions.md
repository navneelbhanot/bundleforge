# M-177 — Bundle list · bulk actions

> Second milestone of Phase R3 (`docs/plans/rich-admin-ui-roadmap.md`).
> Plugs row selection + Polaris IndexFilters' promoted
> bulk-action slot into the chrome shipped by M-176, and adds
> three thin server endpoints that loop over the existing
> single-bundle service methods.

---

## Why

Today the merchant can configure 50 bundles but has to publish
/ archive / delete them one at a time, even from the list view
where they're already looking at the entire roster. Three
common workflows hit this:

- **Holiday push** — flip a batch of "Draft" bundles to
  "Active" the morning of a sale.
- **Post-sale cleanup** — archive a dozen seasonal bundles
  the day after.
- **Migration cleanup** — soft-delete the trial bundles
  after testing the importers from M-127..M-130.

Polaris IndexFilters has a built-in promoted bulk-actions
slot. The frontend cost is low because the IndexFilters
chrome is already in place from M-176. The server side is
also light: each bulk endpoint loops the existing
single-bundle service method (no new business logic) and
collects per-id outcomes.

---

## Scope

### Server

Three new routes in `src/routes/bundles.ts`:

```
POST /api/v1/bundles/bulk/publish
POST /api/v1/bundles/bulk/archive
POST /api/v1/bundles/bulk/delete
```

Request body (all three):
```jsonc
{ "ids": ["uuid", "uuid", ...] }
```

Validation:
- `ids` must be an array of 1..50 strings (cap matches the
  page-load limit; bigger batches risk Shopify rate limits in
  publish).
- Each id is a string; service methods themselves
  cross-check shop ownership.

Response shape (all three):
```jsonc
{
  "succeeded": ["uuid", "uuid"],
  "failed": [
    { "id": "uuid", "reason": "string" }
  ]
}
```

Implementation:
- Loop sequentially (not parallel) to keep error reporting
  deterministic and avoid stampeding Shopify Admin GraphQL
  on the publish path.
- Wrap each `service.publish/archive/softDelete(shopId, id)`
  in try/catch — collect ids that succeed vs fail rather
  than 500ing on the first error.
- `publish` uses the same session-driven `onCreateProduct`
  hook as the single-bundle route (M-051).
- Activity log rows are emitted by the existing service
  methods (M-174 added the writers) — no new code needed
  for audit.

Status: 200 if at least one succeeded; 207 if mixed
(succeeded + failed); 422 if all failed.

### Frontend

`BundlesListTable.tsx`:
- Flip `selectable={true}` on `IndexTable`.
- Drive selection state via `useIndexResourceState` (Polaris
  hook).
- Pass `selectedItemsCount` + `onSelectionChange` to
  `IndexFilters` so the bulk-actions toolbar appears.
- New props: `onBulkPublish`, `onBulkArchive`, `onBulkDelete`,
  `bulkBusy`. The page handles the actual fetch + confirm
  dialogs.

`BundlesListPage.tsx`:
- Selection state lives in the page so post-action refetch
  resets it.
- New handlers `handleBulkPublish/Archive/Delete(ids)`:
  POST the bulk endpoint, then re-fetch the list, then
  surface a Toast summary like "Published 12 bundles" or
  "Published 10, 2 failed (id ...)".
- Confirmation modal for archive + delete (typed-confirm not
  needed — selection itself is the merchant's intent;
  matches how other Shopify admin surfaces handle bulk
  archive). A single confirm modal handles both, parameterised
  by action.
- Publish requires no extra confirmation but shows the toast.

### Tests

- `src/routes/bundles.test.ts` (+5):
  - Bulk publish: succeeds for all valid ids → 200.
  - Bulk archive: rejects empty ids array → 400.
  - Bulk archive: rejects > 50 ids → 400.
  - Bulk delete: partial failure (one id raises NotFound) →
    207 with `failed[]` populated.
  - Bulk publish: when shop-ownership service throws, the
    error is captured per-id, not propagated.
- `frontend/src/components/bundlesList/BundlesListTable.test.tsx`
  (+1):
  - Selecting a row enables the bulk-action UI (verifies
    `selectable={true}` is wired and selection callbacks
    fire).
- `frontend/src/pages/BundlesListPage.test.tsx` (+1):
  - With selection populated, calling the page's
    bulk-publish handler POSTs to `/api/v1/bundles/bulk/publish`
    with the selected ids in the body. (Driven via the page's
    bulk-publish callback rather than UI clicks since
    selection state in jsdom Polaris is fiddly.)

---

## Acceptance criteria

- [x] Compiles, lints clean (no new violations), all vitest
  pass.
- [x] /bundles renders selectable rows with a bulk-action
  toolbar.
- [x] Bulk publish / archive / delete each POST to the right
  endpoint and re-fetch.
- [x] Partial failure is reported (Toast summary).
- [x] Activity log rows are recorded for each affected bundle
  (covered by M-174's existing writers — no new wiring).

---

## Out of scope (deferred)

- **Bulk edit** (e.g. "set status to Active for these 12
  bundles, regardless of current state"). That's a richer UX
  surface and would need a partial-update modal. Wait for a
  merchant ask.
- **CSV import via bulk** — M-069's CSV importer already
  handles the seed-many use case.
- **Async / job-queue bulk** — today's loop is synchronous
  inside the request. For batches > 50 we'd need to push to
  BullMQ; we cap at 50 and document it.
- **"Select all matching filter"** beyond the current page —
  M-176 caps the page at 100 rows; "all matching" without a
  cursor loop on the server is a follow-up.
- **Sort UI + view modes** (table / card / compact) — that's
  M-178.
