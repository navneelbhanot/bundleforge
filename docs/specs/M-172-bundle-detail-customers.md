# M-172 — Bundle Detail · Customers tab

> Fourth milestone of Phase R2 (`docs/plans/rich-admin-ui-roadmap.md`).
> Per-bundle eligibility rules so the merchant can scope a bundle
> to specific customer cohorts.

---

## Why

Today every bundle is visible to every customer. Merchants want
basic gating:

- **VIP-only bundles** — restrict to customers with the `vip` tag.
- **Suppress for wholesale customers** — must-not-have a tag.
- **Login required** — only logged-in customers see the bundle.
- **Market gating** — show in US/CA only, hide in EU.
- **Locale gating** — show only when the storefront is rendered
  in `en` or `fr`.
- **Shopify Segments** — point at a saved Segment for
  arbitrarily complex rules without us building the engine.

This milestone ships the merchant configuration surface +
persistence. As with the rest of Phase R2: storefront/Cart
Transform consumption (the actual rendering / blocking logic at
runtime) lands in M-172b.

---

## Scope

### Server — Prisma schema

Add a single JSON column `eligibility` to the `Bundle` model:

```prisma
eligibility Json @default("{}") @map("eligibility")
```

Migration: `prisma/migrations/<ts>_bundle_eligibility/migration.sql`.
Reviewed before applying per CLAUDE.md §5.

Stored shape:
```jsonc
{
  "customerTagsAllow": ["vip", "early-access"],
  "customerTagsDeny":  ["wholesale"],
  "segmentIds":        ["gid://shopify/Segment/12345"],
  "requireLogin":      true,
  "markets":           ["US", "CA"],          // ISO 3166-1 alpha-2
  "locales":           ["en", "fr"]            // matches SUPPORTED_LOCALES
}
```

All fields optional. An empty/missing field means "no restriction
on this dimension" — the cart-transform logic ANDs them together,
so a bundle with `customerTagsAllow: ["vip"]` and an empty
`markets` is "VIP customers anywhere" not "no one anywhere."

### Server — types + service

- Extend `CreateBundleInput` in `src/types/index.ts` with
  `eligibility?: EligibilityInput`.
- `src/services/bundles/index.ts`:
  - New `validateEligibility(input)` helper (matches the
    M-170/M-171 imperative-Zod pattern):
    - `customerTagsAllow` / `customerTagsDeny` — arrays of
      non-empty strings, max 50 each.
    - `segmentIds` — array of Shopify GID strings, max 20.
    - `requireLogin` — boolean.
    - `markets` — array of 2-letter uppercase ISO country codes,
      max 100.
    - `locales` — array of `SUPPORTED_LOCALES` (re-import from
      `src/i18n`).
  - `create()` validates + persists.
  - `update()` deep-merges (same null-removes-override pattern
    as M-171's displaySettings).

### Frontend

- New `frontend/src/components/bundleDetail/CustomersTab.tsx`.
- Three cards:
  1. **Tag-based eligibility** — Polaris `Tag` chips for
     `customerTagsAllow` (Add input + remove); same for
     `customerTagsDeny`. Helper banner explains "allow takes
     priority — if a customer has both an allow and deny tag,
     they see the bundle."
  2. **Login & Segments** — `Checkbox` for `requireLogin`,
     TextField (multiline) for pasting Shopify Segment GIDs
     one per line (turn into `segmentIds` array on save).
     HelpText points the merchant at Customers → Segments in
     Shopify Admin.
  3. **Market & locale** — Polaris `ChoiceList allowMultiple` of
     30 common ISO country codes for `markets`, ChoiceList
     allowMultiple of 15 supported locales for `locales`.

### Tests

- `src/services/bundles/index.test.ts`:
  - Persists eligibility on create.
  - Rejects unknown locale.
  - Rejects market code that isn't 2-letter uppercase.
  - Rejects > 50 customer tags.
  - Update deep-merges (saving `customerTagsAllow` keeps
    `markets`).
- `frontend/src/components/bundleDetail/CustomersTab.test.tsx`
  (new):
  - Renders the three card headings.
  - Adding an allow-tag chip + Save sends
    `eligibility.customerTagsAllow`.
  - Toggling "Require login" + Save sends
    `eligibility.requireLogin: true`.
  - Picking a market (US) + Save sends
    `eligibility.markets: ["US"]`.

---

## Acceptance criteria

- [x] Compiles, lints clean, all vitest pass.
- [x] /bundles/:id#customers renders three real cards.
- [x] Eligibility round-trips end-to-end (POST + PUT).
- [x] Deep-merge preserves siblings on partial saves.

---

## Out of scope (deferred)

- **M-172b** — Cart Transform Function + storefront blocks
  consuming the eligibility blob at runtime. The function reads
  the bundle product's `mintbundle.eligibility` metafield (we
  already write `mintbundle.components`; eligibility is a
  parallel metafield), evaluates against
  `customer.tags`/`customer.id`/`localization.country`/
  `localization.language`, and either expands or hides the
  bundle.
- Segment validation against Shopify (we accept any GID-shaped
  string today; checking it actually exists on the merchant's
  store is a Shopify Admin GraphQL round-trip).
- "Test eligibility" preview button on the admin tab (would
  simulate a customer profile and show whether they qualify).
