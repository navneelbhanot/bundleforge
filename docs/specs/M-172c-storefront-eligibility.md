# M-172c — Storefront eligibility enforcement

> Companion to M-172b (CTF-side). The Cart Transform
> Function blocks an unqualified bundle from expanding once
> a line is in cart, but the customer can still see the
> bundle widget on the product page and try to add it.
> M-172c hides the widget on the storefront when eligibility
> fails — the cleaner UX path.
>
> Tag-based gating (which the CTF can't do because Shopify
> Functions don't reliably read customer tags) is fully
> covered storefront-side via `customer.tags`.

---

## Why

The CTF runs late: customer browses → adds to cart →
proceeds to checkout → CTF intervenes. By that point,
they've already invested in the flow and a "you can't buy
this" reveal is jarring. Hiding the bundle widget at
render time stops the flow before it starts and lets us
include richer copy ("this bundle is for VIP customers
only").

## Scope

### Server (proxy)

- `src/routes/proxy.ts` `/bundle/:slug` response gains
  `eligibility` (the bundle's resolved blob) so the web
  component can evaluate without a second request.

### Theme block (Liquid)

- `extensions/theme-extension/blocks/bundle-display.liquid`:
  pass storefront customer state into the web component
  via data attributes. Use Shopify's Liquid globals:
  - `data-customer-id` — `{{ customer.id }}` or empty.
  - `data-customer-tags` — `{{ customer.tags | join: "," }}`.
  - `data-country` — `{{ localization.country.iso_code }}`.
  - `data-language` — `{{ localization.language.iso_code }}`.

### Web component (JS)

- `extensions/theme-extension/assets/bundleforge-bundle.js`:
  - New pure `isEligibleStorefront(eligibility, ctx)`
    helper. Mirrors the CTF `isEligible` *plus* tag-based
    gating that the CTF can't do:
    - `customerTagsAllow` non-empty: customer must have at
      least one tag in the list. **Allow takes priority** —
      having an allow tag wins even if a deny tag also
      matches (matches the M-172 admin Banner copy).
    - `customerTagsDeny` non-empty + no allow match:
      reject if customer has any deny tag.
    - All other rules (requireLogin / markets / locales)
      stay the same as the CTF version.
  - `BundleforgeBundle.connectedCallback` reads the
    customer state from `data-*` attributes, evaluates
    eligibility against `bundle.eligibility`, and:
    - On **fail**: render an unobtrusive "This bundle
      isn't available in your region" placeholder *or*
      hide entirely depending on `data-on-ineligible`
      block setting (default: `hide`). The block's Liquid
      schema gets a new Select for the choice.
    - On **pass**: render normally (today's behavior).

### Tests

- `extensions/cart-transform/src/eligibility.test.ts`
  (we're reusing this file for storefront helpers since
  M-172b proved the test-host pattern works there). +5
  cases for the new `isEligibleStorefront`:
  - Tag allow happy path.
  - Tag allow miss → reject.
  - Tag allow + deny: allow wins.
  - Tag deny only + customer has it → reject.
  - All checks pass with full context.

  Actually the helper lives in `bundleforge-bundle.js`
  which the test file can't import (vitest excludes
  `extensions/theme-extension`). So instead:
  
  Add a parallel JS module
  `extensions/theme-extension/eligibility.mjs` that the
  block-side bundleforge-bundle.js imports. Tests import
  it directly via `extensions/theme-extension/eligibility.test.ts`.
  
  But vitest excludes that whole directory. Plan B: put
  the helper inside `extensions/cart-transform/src/`
  alongside `isEligible` (it's the same logic + tag check)
  and re-export. The theme block's Web Component imports
  it via `import { ... } from "../../cart-transform/src/eligibility.js"`.
  Workable but architecturally weird (theme depends on
  CTF code).
  
  Cleanest: ship the helper as plain JS in the theme
  extension and add a new tests location
  (`tests/storefront/eligibility.test.ts` in the
  vitest-included `tests/` dir) that imports the JS
  by path.
  
  Plan: put a small ESM helper file in
  `extensions/theme-extension/assets/eligibility.mjs`
  that bundleforge-bundle.js imports. The test loads it
  directly via dynamic import in `tests/storefront/`.
  vitest's `tests/**/*.test.ts` glob picks it up.

- `src/routes/proxy.merge.test.ts` (or a new
  `proxy.eligibility.test.ts`) +1 — proxy returns
  `eligibility` field on the response.

---

## Acceptance criteria

- [x] Compiles, lints clean, all vitest pass.
- [x] Proxy `/bundle/:slug` exposes `eligibility`.
- [x] Theme block passes customer state to the web
  component.
- [x] Web component hides the bundle when eligibility
  fails.
- [x] Tag-based gating works storefront-side.

## Out of scope

- **Real-time customer-tag refresh** when an admin changes
  tags during the session. The block reads tags at render
  time; a stale-tag window is acceptable.
- **Deny-by-default** for unrecognized customer states
  (e.g. logged out + no markets specified). Today's logic
  is "allow unless a rule rejects" — matches admin intent.
- **Per-locale messaging** of the ineligible placeholder.
  English-only for the initial ship.
