# Session 0177 — Bundle list · bulk actions

- **Date:** 2026-05-06
- **Milestone(s):** M-177
- **Branch:** claude/objective-sinoussi-77ae86
- **Commit(s):** TBD

---

## Goal

Plug row selection + Polaris IndexFilters' promoted
bulk-action slot into the chrome shipped by M-176, and add
three thin server endpoints that loop the existing
single-bundle service methods.

## What was done

- **Spec written:**
  `docs/specs/M-177-bundle-list-bulk-actions.md`.

- **Server** (`src/routes/bundles.ts`):
  - New `BulkBody` Zod schema enforcing
    `ids: string[]` (1..50).
  - Three new routes registered **before** the `/:id/*`
    matchers (Express first-match routing — otherwise
    `POST /bundles/bulk/publish` would route to
    `/:id/publish` with `id="bulk"`):
    - `POST /api/v1/bundles/bulk/publish`
    - `POST /api/v1/bundles/bulk/archive`
    - `POST /api/v1/bundles/bulk/delete`
  - Each loops `service.publish/archive/softDelete(shopId, id)`
    sequentially (deterministic error reporting + avoids
    stampeding Shopify Admin GraphQL on the publish path).
  - Per-id try/catch collects outcomes:
    `{ succeeded: string[], failed: Array<{ id, reason }> }`.
  - Status: 200 (all succeeded) / 207 (mixed) / 422 (all
    failed). 400 for shape errors via Zod.
  - Bulk publish reuses the same `onCreateProduct` hook as the
    single-bundle route — Shopify product creation runs on
    first publish, additional publishes reuse the existing
    GID.
  - **No new business logic** — activity log rows are
    emitted by the existing service methods (M-174 added the
    writers).

- **Frontend**
  (`frontend/src/components/bundlesList/BundlesListTable.tsx`):
  - Added `useIndexResourceState` to track selection.
  - Flipped `IndexTable selectable` to `true` and wired
    `selectedItemsCount` + `onSelectionChange`.
  - New props: `onBulkPublish`, `onBulkArchive`,
    `onBulkDelete`, `bulkBusy`.
  - `promotedBulkActions` array conditionally adds the three
    actions when their callbacks are provided. Publish runs
    immediately; Archive + Delete open a confirmation modal
    parameterised by action.
  - Bulk confirm modal copy explains: archive → "removed
    from storefront, can be moved back to draft"; delete →
    "hidden from storefront and list, past orders keep
    history, reversible until next GDPR shop-redact".

- **`BundlesListPage`** wiring:
  - New `runBulk(path, ids)` helper POSTs to the bulk
    endpoint, parses the partial-success envelope, and emits
    a Toast like "Published 12 bundles" or "Published 10, 2
    failed".
  - Three thin wrappers `handleBulkPublish/Archive/Delete`
    pass into the table.
  - Wrapped page in `Frame` so Polaris `Toast` can mount.
  - Refetches the bundle list after every bulk run so the
    statuses + filtered counts stay accurate.

## Tests added

- `src/routes/bundles.test.ts` (18 cases, +6):
  - Bulk publish: succeeds for all valid ids → 200.
  - Bulk archive: rejects empty ids array → 400.
  - Bulk archive: rejects > 50 ids → 400.
  - Bulk delete: partial failure → 207 with `failed[]`
    populated.
  - Bulk publish: all-fail → 422.
  - Bulk publish: per-id error captured, never propagated
    as 5xx.

- `frontend/src/components/bundlesList/BundlesListTable.test.tsx`
  (7 cases, +2):
  - Selectable rows render row checkboxes.
  - Selecting + clicking Archive opens the bulk confirm
    modal with the correct heading.

- `frontend/src/pages/BundlesListPage.test.tsx` (4 cases, +1):
  - End-to-end: clicking a row checkbox + the promoted
    Publish bulk action POSTs to
    `/api/v1/bundles/bulk/publish` with the selected ids.

## Acceptance criteria status

- [x] Compiles, lints clean (no new violations), 659/659
  vitest pass.
- [x] /bundles renders selectable rows with the bulk-action
  toolbar.
- [x] Bulk publish / archive / delete each POST to the right
  endpoint and re-fetch.
- [x] Partial failure surfaces in a Toast.
- [x] Activity log rows recorded for each affected bundle
  (covered by M-174's existing writers).

## Verified by hand

- `npx vitest run src/routes/bundles.test.ts` → 18/18.
- `npx vitest run frontend/src/components/bundlesList/BundlesListTable.test.tsx`
  → 7/7.
- `npx vitest run frontend/src/pages/BundlesListPage.test.tsx`
  → 4/4.
- `npx vitest run` (full) → 659 passed, 13 skipped.
- `npm run typecheck` → clean.
- `npm run lint` → 6 pre-existing errors / 17 pre-existing
  warnings; no new violations.

## Deferred

- **Bulk edit** (e.g. "set status to Active for all 12,
  regardless of current state"). Richer UX with a partial-
  update modal — wait for a merchant ask.
- **Async / job-queue bulk** for batches > 50 — today's loop
  is synchronous inside the request, so we cap and document
  the cap. Push to BullMQ when needed.
- **"Select all matching filter"** beyond the current page.
  M-176 caps page-load at 100 rows. Server-side "all
  matching" without a cursor loop is a follow-up.
- **Sort UI + view modes** (table / card / compact) — that's
  M-178.

## Notes

Route ordering matters: Express matches in registration
order, so the bulk routes (`POST /bulk/X`) had to be
registered **before** `/:id/X` matchers. Otherwise
`POST /bundles/bulk/publish` would route to `/:id/publish`
with `req.params.id = "bulk"` and 404 on a NotFoundError from
the service. The new routes live in their own section just
after `POST /` and just before the `/:id/...` block.

Bulk publish loops sequentially rather than `Promise.all` to
avoid Shopify Admin GraphQL rate limits when the merchant
publishes 50 bundles at once. Each iteration reuses the same
session-bound `onCreateProduct` hook the single-bundle route
uses, so first-publish creates the Shopify product and
subsequent publishes reuse the existing GID — same logic as
M-051.

Activity log writes already happen inside
`service.publish/archive/softDelete` from M-174. Bulk simply
calls those methods, so a 12-bundle bulk publish writes 12
`published` rows automatically — no duplication or new
writer.

The bulk confirm modal copies the soft-delete reversibility
language from the per-bundle Advanced tab Danger zone (M-175)
so the merchant gets the same message regardless of where
they trigger the action. Merchants pattern-match on the
copy across the admin.

Phase R3 progress: 2 of 4 done. M-178 (sort + view modes +
true pagination) is next; it plugs into the IndexFilters
sort prop and gives the merchant a real "next page" cursor
when the result set exceeds 100.
