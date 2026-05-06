# Session 0179 — Bundle list · templates / preset gallery (closes Phase R3)

- **Date:** 2026-05-06
- **Milestone(s):** M-179
- **Branch:** claude/objective-sinoussi-77ae86
- **Commit(s):** TBD

---

## Goal

Close Phase R3 with a curated gallery of starter bundles. A
merchant lands on the bundle list, clicks "Browse templates",
picks a starter that matches their promotion shape, and
lands on a pre-configured draft Bundle Detail page — title,
type, and pricing rules pre-filled, only the items left to
add via the existing ResourcePicker.

## What was done

- **Spec written:**
  `docs/specs/M-179-bundle-list-templates.md`.

- **Server**:
  - New `src/services/bundles/templates.ts` exporting
    `BundleTemplate`, `BUNDLE_TEMPLATES` (6 starter
    templates), and `findTemplate(id)`.
  - Templates carry `id`, `label`, `description`,
    `category`, `type`, `defaultTitle`, `config`,
    `pricingRules`. **No items** — the merchant adds their
    own SKUs after instantiate. Keeps the registry
    product-agnostic.
  - Initial seed: Holiday gift box (fixed, 15% off), BOGO
    weekender (bogo), Build-a-box starter (build_box, 4
    steps + 10% off), Mix-and-match trio (mix_match, $20
    off any 3), Subscription starter (subscription),
    Volume tier starter (volume, 5/10/15% at 5/10/25
    units).
  - Two new routes registered alongside the bulk routes
    (before `/:id/*`):
    - `GET /api/v1/bundles/templates` → `{ data: [...] }`
    - `POST /api/v1/bundles/templates/:id/instantiate` →
      201 `{ id }`. Looks up the template, calls
      `service.create(shopId, { ...template, items: [] })`,
      returns the new bundle's id.
    - 404 when the template id doesn't exist.

- **Frontend**:
  - New
    `frontend/src/components/bundlesList/TemplatesModal.tsx`:
    Polaris `Modal size="large"` with a `ChoiceList` of
    category filter chips (Promo / Seasonal / Subscription
    / Starter) above a `Grid` of template cards. Each card
    shows the category badge, type, label, description,
    and a "Use this template" button.
  - `BundlesListPage` wiring:
    - New `templates` state (lazy-loaded the first time
      the modal opens).
    - `openTemplates()` fetches `/api/v1/bundles/templates`
      once; subsequent opens reuse the cached list.
    - `handleUseTemplate(id)` POSTs the instantiate
      endpoint and navigates to `/bundles/<newId>#setup`
      on success.
    - "Browse templates" exposed in two surfaces:
      `secondaryActions` on the populated-list `Page`
      header, and a new button in the
      `FreshShopDashboard` CTA row.
  - Wrapped the fresh-shop branch in `Frame` so the
    Polaris Modal can mount its portal.

## Tests added

- New `src/services/bundles/templates.test.ts` (5 cases):
  - Registry is non-empty.
  - Every template's type is in `BUNDLE_TYPES`.
  - Every template's config validates against its per-type
    schema (`validateBundleConfig`).
  - Template ids are unique.
  - `findTemplate` returns the right template by id and
    `undefined` for unknown ids.

- `src/routes/bundles.test.ts` (21 cases, +3):
  - `GET /templates` returns the registry.
  - `POST /templates/holiday-gift-box/instantiate` calls
    `service.create` with the template's title + type +
    config + pricing rules and returns 201.
  - `POST /templates/does-not-exist/instantiate` → 404 and
    `service.create` is never called.

- New `frontend/src/components/bundlesList/TemplatesModal.test.tsx`
  (3 cases):
  - Renders one card per template.
  - Clicking the second "Use this template" calls
    `onUseTemplate("bogo-weekender")`.
  - Renders nothing user-visible when `open=false`.

- `frontend/src/pages/BundlesListPage.test.tsx` (6 cases, +1):
  - Clicking "Browse templates" fetches the templates
    endpoint and renders the modal with the template's
    title heading.

## Acceptance criteria status

- [x] Compiles, lints clean (no new violations), 676/676
  vitest pass.
- [x] /bundles renders a "Browse templates" button.
- [x] Clicking a template's "Use this template" creates a
  draft and navigates to it.
- [x] Templates registry is in version control; no DB or
  external dependencies at runtime.
- [x] **Phase R3 closes**: 4/4 milestones (M-176..M-179)
  done.

## Verified by hand

- `npx vitest run src/services/bundles/templates.test.ts`
  → 5/5.
- `npx vitest run src/routes/bundles.test.ts` → 21/21.
- `npx vitest run frontend/src/components/bundlesList/TemplatesModal.test.tsx`
  → 3/3.
- `npx vitest run frontend/src/pages/BundlesListPage.test.tsx`
  → 6/6.
- `npx vitest run` (full) → 676 passed, 13 skipped.
- `npm run typecheck` → clean.
- `npm run lint` → 6 pre-existing errors / 17 pre-existing
  warnings; no new violations.

## Deferred

- **User-defined templates** ("save the current bundle as a
  reusable template"). Today the registry is read-only.
  Adding a per-shop `templates` array on `Shop.settings` is
  the natural next step.
- **Template marketplace / sharing across shops**. Out of
  scope.
- **Template images / mocked storefront previews**. Card
  text + badge are enough for the initial gallery.
- **Per-template recommended product types** (e.g. "works
  best with apparel"). A future `tags: string[]` extension.
- **Onboarding wizard integration** — surface the templates
  inside the existing 3-step OnboardingWizard. Possible R4
  candidate.

## Notes — Phase R3 retrospective

Phase R3 (M-176..M-179) shipped four milestones in one day,
turning the bundle list from a bare 20-row IndexTable into
a full IndexFilters surface:

- M-176: search + status/type chip filters + saved views
  persisted to `Shop.settings`.
- M-177: row selection + bulk publish/archive/delete
  endpoints.
- M-178: 6-option sort dropdown + true server-driven
  pagination + Table/Compact/Card view modes (saved views
  round-trip the chosen mode).
- M-179: a curated 6-template gallery with a
  one-click "Use this template" flow.

Saved views in M-176 turned out to be the right hub: M-178
extended the Zod schema to include `sort` + `viewMode`
without any new server routes, and M-179 needed nothing
from the saved-views surface at all. The "merchant tweaks
filters in place, drops back to All" UX from M-176 carried
through every R3 milestone.

Phase R4 starts next: cross-cutting polish (M-180 cmd+k
search, M-181 in-app help drawer, M-182 unified
toast/confirm/skeleton patterns, M-183 empty-state
illustrations).
