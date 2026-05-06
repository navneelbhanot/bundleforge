# M-179 — Bundle list · templates / preset gallery

> Final milestone of Phase R3 (`docs/plans/rich-admin-ui-roadmap.md`).
> Closes the phase. A curated set of starter bundles a merchant
> can clone with one click — pre-configured type + pricing
> strategy + sensible defaults — so they don't have to start
> from a blank create form.

---

## Why

Today a fresh merchant lands on `/bundles/new` and gets a
blank type picker with 13 options + a list of pricing rule
types and per-type config knobs. That's a lot of choices for
someone who wants a "two-for-one promo" or a "$50 holiday
gift box" today and figure out the rest later.

Templates short-circuit the decision tree: pick "BOGO
Weekender", click "Use this template", and you land on the
Bundle Detail page with the right type, the right pricing
rule, and a friendly title — your only remaining job is to
pick the actual products via the existing ResourcePicker.

This is also the natural place to seed the experimentation
that lets us learn which bundle shapes drive conversion in
beta.

---

## Scope

### Server — templates registry

New `src/services/bundles/templates.ts` exporting:
```ts
export interface BundleTemplate {
  id: string;                  // "holiday-gift-box", "bogo-weekender", etc.
  label: string;               // human-readable name shown in the gallery
  description: string;         // 1–2 sentence pitch
  category: "promo" | "seasonal" | "subscription" | "starter";
  type: BundleType;            // maps to existing BUNDLE_TYPES
  defaultTitle: string;        // pre-fills the title field on the new draft
  config: Record<string, unknown>;
  pricingRules: CreatePricingRuleInput[];
}
export const BUNDLE_TEMPLATES: BundleTemplate[] = [...];
```

Initial seed (6 templates):
1. **Holiday gift box** (`fixed`) — 15% off, "Holiday Gift
   Box" title.
2. **BOGO weekender** (`bogo`) — buy-one-get-one rule.
3. **Build-a-box starter** (`build_box`) — 4-step build flow,
   10% off when complete.
4. **Mix-and-match trio** (`mix_match`) — pick any 3, fixed
   $20 off.
5. **Subscription starter** (`subscription`) — recurring
   bundle scaffold for Recharge wiring.
6. **Volume tier starter** (`volume`) — 5% / 10% / 15% off
   at 5 / 10 / 25 units.

Templates **don't carry items** — the merchant adds their
own products via the existing ResourcePicker after
instantiate. This keeps the registry product-agnostic
(no Shopify GIDs to invalidate) and makes the merchant own
the "which SKUs?" decision.

### Server — routes

New routes registered before `/:id/*` matchers (same
ordering rule as M-177's bulk routes):

```
GET  /api/v1/bundles/templates
POST /api/v1/bundles/templates/:id/instantiate
```

`GET` returns `{ data: BundleTemplate[] }`. Read-only,
fast, no DB hit.

`POST :id/instantiate`:
- Looks up the template by `id` in the registry.
- 404 if the template doesn't exist.
- Calls `service.create(shopId, {...template, items: []})`
  to materialise the bundle as a draft.
- Returns `201 { id: string }` (the new bundle's id) so the
  client can navigate.

No new schema column, no migration.

### Frontend

New `frontend/src/components/bundlesList/TemplatesModal.tsx`:
- Polaris `Modal` containing a Polaris `Grid` of template
  cards.
- Each card shows: category badge, title, description, and
  a "Use this template" button.
- Optional category filter chips at the top (Promo / Seasonal
  / Subscription / Starter).
- On "Use this template": calls
  `POST /api/v1/bundles/templates/:id/instantiate`, then
  navigates to `/bundles/<newId>#setup`.

Wire into `BundlesListPage`:
- New "Browse templates" secondary button next to "Create
  bundle" in the `Page` primary-action area.
- Same button on the `FreshShopDashboard` (alongside the
  existing "Create your first bundle" / "Take the tour"
  CTAs).

### Tests

- New `src/services/bundles/templates.test.ts` (3 cases):
  - `BUNDLE_TEMPLATES` is non-empty and every template has
    a known `BundleType`.
  - Every template's `pricingRules` validates against the
    PricingRule schema.
  - Template ids are unique.

- `src/routes/bundles.test.ts` (+3):
  - GET /templates returns the registry.
  - POST /templates/:id/instantiate creates a draft via
    `service.create` and returns 201 with the new id.
  - POST /templates/unknown/instantiate → 404.

- New `frontend/src/components/bundlesList/TemplatesModal.test.tsx`
  (3 cases):
  - Renders one card per template.
  - Filtering by category narrows the visible list.
  - Clicking "Use this template" calls
    `onUseTemplate(templateId)`.

- `frontend/src/pages/BundlesListPage.test.tsx` (+1):
  - Clicking "Browse templates" opens the modal (asserts a
    template heading is visible).

---

## Acceptance criteria

- [x] Compiles, lints clean (no new violations), all vitest
  pass.
- [x] /bundles renders a "Browse templates" button.
- [x] Clicking a template's "Use this template" creates a
  draft and navigates to it.
- [x] Templates registry is in version control; no DB or
  external dependencies at runtime.
- [x] **Phase R3 closes**.

---

## Out of scope (deferred)

- **User-defined templates** (save the current bundle as a
  reusable template). Out of scope today; the registry is
  read-only. Adding a per-shop `templates` array on
  `Shop.settings` is the natural next step.
- **Template marketplace / sharing across shops**. Way out
  of scope.
- **Template images / mocked storefront previews**. Card
  text + badge is enough for the initial gallery.
- **Per-template recommended product types** ("works best
  with apparel"). Could be a `tags: string[]` on the
  template; not in M-179.
- **Onboarding / Take-the-tour wizard integration** —
  surface templates inside the wizard. Possible in a future
  R4 milestone.
