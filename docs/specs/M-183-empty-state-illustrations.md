# M-183 — Empty-state illustrations

> Final milestone of Phase R4 (`docs/plans/rich-admin-ui-roadmap.md`).
> Closes the rich-admin-ui sequence (M-161..M-183, 23
> milestones). Replaces the bare `image=""` Polaris
> `EmptyState` calls scattered across list pages with a small
> set of inline SVG illustrations and a shared
> `<EmptyStateCard />` wrapper so every empty surface looks
> intentional.

---

## Why

Phase R3 added IndexFilters chrome to the bundle list (which
gets its own friendly fresh-shop dashboard from
`FreshShopDashboard`), but the rest of the admin's list
pages still render Polaris `<EmptyState image="" />` —
heading text + a Create-a-bundle button, no graphic. That
reads as "we forgot to fill this in," not "you're at the
start of something."

Polaris's own `EmptyState` accepts an image URL. We don't
want to ship raster assets (deploy bloat, retina blur), and
the project doesn't have a markdown / icon library beyond
what M-181 added. Inline SVG → data URI is the cleanest fit:
no extra dependencies, no asset pipeline changes, themable
via CSS variables, and small enough to live in the codebase
as plain TypeScript constants.

---

## Scope

### Frontend

New `frontend/src/components/shell/illustrations.ts`:
- Exports a small registry of named illustrations:
  `orders`, `analytics`, `audit`, `inventory`, `ai`.
- Each illustration is an inline SVG converted to a data
  URI (`data:image/svg+xml;utf8,...`). 100% width × ~120px
  tall, single accent color, minimalist.
- A small `getIllustration(name)` helper returns the data
  URI string.

New `frontend/src/components/shell/EmptyStateCard.tsx`:
- Wraps Polaris `Card` + `EmptyState` with one component
  call.
- Props:
  - `illustration?: keyof typeof ILLUSTRATIONS` — pulls
    from the registry. Falls back to `image=""` when
    omitted.
  - `heading: string`
  - `body?: string | ReactNode`
  - `primaryAction?: { content: string; url?: string;
    onAction?: () => void }`
  - `secondaryAction?: { content: string; url?: string;
    onAction?: () => void }`
- Renders the illustration via `image={getIllustration(...)}`
  on the underlying Polaris `EmptyState`.

### Migrations

Five surfaces:
1. `OrdersListPage` — `orders` illustration.
2. `AnalyticsOverviewPage` — `analytics` illustration.
3. `InventoryAuditPage` — `audit` illustration.
4. `AiSuggestionsPage` — `ai` illustration.
5. `BundleDetailPage` Items section ("No items yet" empty
   state) — `inventory` illustration (the "build a stack of
   things" visual works for an items list too).

`InventoryHealthPage` already has its own custom empty card;
leave it alone (out of scope).

### Tests

- New `frontend/src/components/shell/EmptyStateCard.test.tsx`
  (3 cases):
  - Renders the heading and primary-action button.
  - Resolves a known illustration to a non-empty `<img>`
    `src` attribute.
  - Falls back to no illustration when `illustration` is
    omitted (no `<img>` rendered or `src=""`).

- New `frontend/src/components/shell/illustrations.test.ts`
  (1 case):
  - Every entry in `ILLUSTRATIONS` returns a string that
    starts with `data:image/svg+xml`.

- Existing page tests stay green — Polaris EmptyState's
  output is unchanged structurally (heading + body +
  action button), only the `image` prop now points at a
  data URI.

---

## Acceptance criteria

- [x] Compiles, lints clean (no new violations), all vitest
  pass.
- [x] Five empty-state surfaces render the new illustrations.
- [x] `<EmptyStateCard />` is a one-call wrapper that
  replaces ~6 lines of `<Card><EmptyState .../></Card>` per
  consumer.
- [x] **Phase R4 closes — M-161..M-183 (23 milestones)
  complete.**

---

## Out of scope (deferred)

- **A full icon set** for buttons / sidebar nav. Polaris
  ships its own `Icon` component; M-183 stays narrowly
  scoped to empty-state graphics.
- **Dark-mode-aware illustrations**. Polaris itself
  doesn't ship a dark theme yet for the embedded admin;
  the illustrations use Polaris CSS variables where
  possible so they'll follow whenever Polaris adds dark
  mode.
- **Animations** on the illustrations. The static SVGs are
  fine for the launch.
- **Per-tenant branding** of the illustrations. The
  Settings General tab already accepts a brandColor; using
  it as the illustration accent is a follow-up.
