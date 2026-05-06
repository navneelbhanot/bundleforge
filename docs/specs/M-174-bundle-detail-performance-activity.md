# M-174 — Bundle Detail · Performance + Activity log tabs

> Sixth milestone of Phase R2 (`docs/plans/rich-admin-ui-roadmap.md`).
> Two tabs in one milestone — both relatively light because each
> reuses existing infrastructure. Performance reads the analytics
> endpoint already shipped in M-112; Activity adds a thin
> per-bundle audit trail of admin actions.

---

## Why

Today after a merchant configures a bundle (Setup / Schedule /
Display / Customers / Inventory) there are two questions they
can't answer from the admin:

1. **"Is this bundle working?"** — needs revenue / conversion /
   funnel by event type at the bundle level. The
   `/api/v1/analytics/bundles/:id` endpoint ships these numbers
   (M-112) but no tab consumes them yet.
2. **"What changed and when?"** — when a merchant has 50
   bundles and a half-dozen team members, "who set the safety
   lock and when" matters. There's no per-bundle log surface
   today; `inventory_audit_log` covers stock changes only and
   is keyed on inventory item GIDs, not "the merchant clicked
   Save on the Display tab."

Both gaps can be closed in one milestone because Performance is
read-only against an existing endpoint and Activity needs only a
small new table + a few writer hooks.

---

## Scope

### Server — Performance

No server changes. The Performance tab reads
`GET /api/v1/analytics/bundles/:id` (already shipped), which
returns `groups: [{ eventType, count, revenue }]`. The frontend
derives KPIs (purchases, revenue, conversion rate, AOV) from
that shape.

### Server — Activity log

New Prisma model:

```prisma
model BundleActivityLog {
  id        String   @id @default(uuid()) @db.Uuid
  shopId    String   @map("shop_id") @db.Uuid
  bundleId  String   @map("bundle_id") @db.Uuid
  action    String                              // "published" | "archived" | "moved_to_draft" | "details_updated" | "items_updated" | "pricing_updated" | "schedule_updated" | "display_updated" | "eligibility_updated" | "inventory_rules_updated" | "deleted"
  summary   String                              // human-readable, e.g. "Title changed to 'Holiday Box'"
  metadata  Json     @default("{}")             // optional structured detail (changed keys, before/after for primitives)
  createdAt DateTime @default(now()) @map("created_at")

  shop      Shop     @relation(fields: [shopId], references: [id], onDelete: Cascade)
  bundle    Bundle   @relation(fields: [bundleId], references: [id], onDelete: Cascade)

  @@index([shopId, bundleId, createdAt(sort: Desc)])
  @@map("bundle_activity_log")
}
```

Migration: `prisma/migrations/<ts>_bundle_activity_log/migration.sql`.
Reviewed before applying per CLAUDE.md §5.

Repository: `src/services/bundles/activityRepo.ts` with two
methods:
- `append(input: { shopId, bundleId, action, summary, metadata? })`
- `list(shopId, bundleId, { page, limit })` returning paginated
  rows ordered by `createdAt DESC`.

Service hooks in `BundleService` — call `activityRepo.append`
from:
- `publish()` → `published`
- `archive()` → `archived`
- `softDelete()` → `deleted`
- `update()` → one entry per "section" that changed in the
  patch (`details_updated`, `items_updated`, `pricing_updated`,
  `schedule_updated`, `display_updated`, `eligibility_updated`,
  `inventory_rules_updated`, plus `moved_to_draft` if
  `status` flipped to draft via update). Multiple updates in a
  single PUT can produce multiple log rows; that's expected
  and the timeline reads naturally.

Writes are best-effort: a logging failure must NOT fail the
underlying mutation. Wrap each `append` in a try/catch that
logs at warn and swallows.

Route: `GET /api/v1/bundles/:id/activity?page=&limit=` returns
`{ data: [...], pagination: {...} }` mirroring the existing
list shape used elsewhere.

### Frontend

- New `frontend/src/components/bundleDetail/PerformanceTab.tsx`:
  - Lazy-fetches `/api/v1/analytics/bundles/:id` on tab mount.
  - KPI strip: Views, Add-to-cart, Purchases, Revenue,
    Conversion rate (purchase / view), AOV (revenue /
    purchase).
  - Empty state when all event counts are 0 — explains data
    appears once the storefront emits events.
  - Skeleton while loading.

- New `frontend/src/components/bundleDetail/ActivityTab.tsx`:
  - Paginated list (page/limit), default page=1 limit=20.
  - Each row: action badge + summary + relative time (e.g.
    "2 hours ago") with absolute time on hover.
  - Empty state for newly created bundles: "No activity yet —
    actions are recorded here when you publish, archive, or
    save changes."
  - Pagination via Polaris `Pagination` component with
    `hasNext`/`hasPrev` from server response.

- Wire both into `BundleDetailPage`:
  - Both tabs lazy-load their own data on entry.
  - Update placeholder fallback to exclude `performance` and
    `activity`.
  - `Activity` tab is the same hash branch (M-169 already
    reserved `#activity` and `#performance`).

### Tests

- `src/services/bundles/index.test.ts` (+3):
  - `publish()` appends a `published` activity log entry.
  - `archive()` appends an `archived` entry.
  - `update({ displaySettings, eligibility })` appends two
    entries — one per changed section.
- `src/routes/bundles.test.ts` or new `bundles.activity.test.ts`
  (+2):
  - GET activity returns paginated list.
  - GET activity respects `?limit=`.
- `frontend/src/components/bundleDetail/PerformanceTab.test.tsx`
  (new, 3 cases):
  - Renders empty state when all counts are zero.
  - Renders KPI numbers from a populated response.
  - Computes conversion rate as `purchases / views` (rounded).
- `frontend/src/components/bundleDetail/ActivityTab.test.tsx`
  (new, 3 cases):
  - Empty state when the server returns `data: []`.
  - Renders one row per activity entry with action + summary.
  - Pagination Next button hits `?page=2`.
- `frontend/src/pages/BundleDetailPage.test.tsx` (+1):
  - `#performance` deep-link asserts the new tab heading.
  - `#activity` deep-link asserts the new tab heading.
  - Update placeholder regression test to use `#advanced`
    (still placeholder for M-175).

---

## Acceptance criteria

- [x] Compiles, lints clean (no new violations), all vitest pass.
- [x] /bundles/:id#performance renders KPIs from analytics.
- [x] /bundles/:id#activity renders paginated list.
- [x] publish() / archive() / update() write activity rows.
- [x] Activity write failure does NOT fail the underlying mutation.

---

## Out of scope (deferred)

- **Per-field diffs** — today's `update_*` entries name the
  *section* that changed, not which key. A "Title changed from
  X to Y" view is a UX nicety; the structured `metadata` JSON
  carries enough hints for a future build.
- **Actor identity** — `Session` carries shop, not the human
  who clicked Save. We log shop-scoped only. Once Shopify's
  collaborator API exposes a stable user id we'll thread it
  through.
- **CSV / JSON export of the activity log** — useful for
  compliance reviews, but no merchant has asked. Easy to add
  on top.
- **Performance over a date range** — today the analytics
  endpoint sums all-time; date-range filters land when the
  shop-level Analytics page gets the same treatment.
- **Comparison to a "similar bundle"** — would need an
  embedding/similarity service; out of scope.
