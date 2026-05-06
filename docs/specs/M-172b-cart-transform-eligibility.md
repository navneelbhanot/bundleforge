# M-172b — Cart Transform reads eligibility metafield

> Behavior wiring for M-172. The Customers tab persists per-
> bundle eligibility (customer tag allow/deny, segment GIDs,
> requireLogin, markets, locales). M-172b plumbs that
> through to the Cart Transform Function so a bundle that's
> in cart but no longer qualifies (e.g. customer's market
> changed) is treated as plain product lines instead of an
> expanded bundle.

---

## Why

Eligibility was always intended as a runtime check, not just
admin metadata. Today nothing reads `Bundle.eligibility`; the
storefront and CTF treat all bundles the same. M-172b plumbs
two pieces:

1. **Server**: on `publish()`, write
   `bundleforge.eligibility` JSON metafield onto the bundle
   product (parallel to the existing
   `bundleforge.is_bundle` + `bundleforge.components`).
2. **CTF**: fetch the new metafield + cart's
   `buyerIdentity.customer.tags` +
   `localization.{country,language}.isoCode`. If
   eligibility evaluation fails, **skip the expand
   operation** for that line — the bundle stays as a
   placeholder line, which atomic checkout (M-086) will
   refuse downstream.

Hiding the bundle widget on the storefront (so an
unqualified customer never adds it in the first place) is
the theme block's job and is not in M-172b.

---

## Scope

### Server

`src/routes/bundles.ts` `defaultCreateShopifyProduct`:
- The publish flow already writes 3 metafields. Add a 4th:
  `bundleforge.eligibility` (JSON) carrying the bundle's
  resolved `eligibility` object.
- The bundle service's publish path passes `eligibility`
  through to `onCreateProduct` so the route can serialize
  it.

`src/services/bundles/index.ts`: extend the publish-callback
contract to include `eligibility?: EligibilityInput` on the
input object.

### Cart Transform Function

`extensions/cart-transform/src/run.graphql`:
- New product metafield read:
  `eligibilityMetafield: metafield(namespace: "bundleforge", key: "eligibility") { value }`.
- New cart-level reads:
  - `buyerIdentity.customer { id, tags }`.
  - `cart.buyerIdentity.email` (already implicit; not
    needed).
  - `localization.country.isoCode` and
    `localization.language.isoCode`.

`extensions/cart-transform/src/run.js`:
- New pure helper `isEligible(metafieldValue, ctx)`:
  - Parses the JSON eligibility blob.
  - Applies allow/deny tag rules: if `customerTagsAllow`
    is non-empty, customer must have at least one of those
    tags. Allow takes priority — having an allow tag wins
    even if a deny tag also matches (matches the M-172
    admin Banner copy).
  - If `customerTagsDeny` set and customer has any of
    them (and no allow match), reject.
  - If `requireLogin === true` and no customer id →
    reject.
  - If `markets` set and current country not in list →
    reject.
  - If `locales` set and current language not in list →
    reject.
  - segmentIds: not evaluated client-side (Shopify
    Functions can't hit the segment API). The metafield
    carries them for future use; the CTF treats their
    presence as "trust the merchant's tag-based gating
    instead" — i.e. ignore.
  - Returns boolean.
- The expand-path for-loop: when eligibility is present
  and evaluates false, skip the expand operation for that
  line. (Functionally reverts the bundle to a plain
  no-expand cart line, which checkout-guardian will
  later refuse.)

### Tests

- `extensions/cart-transform/src/run.eligibility.test.ts`
  (new, 6 cases):
  - Pure `isEligible` helper:
    - No metafield → eligible.
    - allow=["vip"] + customer has "vip" → eligible.
    - allow=["vip"] + customer has no tags → not eligible.
    - allow + deny: allow wins.
    - markets=["US"] + country="CA" → not eligible.
    - locales=["en"] + language="fr" → not eligible.
  - Integration: a single line with eligibility-fail
    skips expand; siblings still expand.

- `src/routes/bundles.test.ts` (+1):
  - Publish flow writes the eligibility metafield (verify
    the productCreate mutation receives a 4th metafield
    with key="eligibility").

---

## Acceptance criteria

- [x] Compiles, lints clean (no new violations), all
  vitest pass.
- [x] On publish, the bundle product has 4 metafields.
- [x] CTF skips expand when eligibility fails.
- [x] No new third-party deps.

---

## Out of scope (deferred)

- **Theme block hides the bundle widget when not eligible.**
  That's the cleanest UX (don't even show the buy button)
  but lives in `bundleforge-bundle.js` and the proxy. M-172c
  if/when needed.
- **Segment GID resolution.** Shopify Functions can't make
  Admin API calls; the merchant's tag list is the
  practical fallback today.
- **A "you're not eligible" custom message in the cart.**
  Cart Transform can't add user-visible text.
- **Re-write `bundleforge.eligibility` on update().** Today
  it's only written at publish (first product create).
  Editing the eligibility from the admin doesn't propagate
  to the metafield until the merchant un-publishes +
  re-publishes. Scope creep to fix today; flag if a beta
  merchant trips on it.
