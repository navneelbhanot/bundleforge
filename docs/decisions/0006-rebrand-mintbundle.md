# ADR 0006 — Rebrand from "BundleForge" to "MintBundle"

- **Date:** 2026-05-07
- **Status:** Accepted
- **Context:** The product name "BundleForge" became a Shopify App Store
  blocker mid-launch.

---

## Decision

Rebrand the entire product, app, and domain from **BundleForge** to
**MintBundle** before App Store submission.

## Why

On 2026-05-01 — six days before our planned submission — a
competitor (JRL Software) launched a Shopify app named
**"BundleForge"** in the same product-bundling category. Verified
via the App Store URL `apps.shopify.com/bundleforge-1`. The "-1"
slug suffix confirms Shopify already considers the name `bundleforge`
locked.

Shopify's review team rejects submissions whose names are
"confusingly similar to existing apps in the same category." JRL's
listing is bit-identical to ours (case + spelling). Submitting
under "BundleForge" guarantees rejection and a 7–14 day review-loop
penalty per attempt.

Independently, the development store +draft app combo on Shopify's
side was poisoned during today's billing iteration (multiple
HTTP 403s during OAuth + admin API calls). A fresh Partner Dashboard
app entry under a new name is the cleanest reset path.

## Considered alternatives

1. **Keep "BundleForge" and dispute the trademark.**
   Rejected: neither party has a registered trademark; first-to-app-
   store wins on Shopify; legal route is slow + expensive for a
   pre-revenue startup.

2. **Submit as "BundleForge Pro" / "BundleForge Plus" / etc.**
   Rejected: Shopify explicitly prohibits "differentiating modifiers"
   in app names per their App Store guidelines.

3. **Rebrand to "ForgeBundle".**
   Rejected: ~30% chance Shopify review flags it as confusingly
   similar to "BundleForge" (same words, different order). Wasting a
   week on rejection isn't worth the brand-DNA continuity benefit.

4. **Rebrand to "Bundlecraft", "PackForge", "Stackr",
   "Bundlemint", "Bundlebar", or similar.**
   Rejected: Bundlecraft taken on Shopify (Fabian Eppinger,
   2026-05-05). PackForge / Stackr / Bundlee taken at the .com or
   .app level. Bundlemint / Bundlebar have .com taken by domainers
   (premium pricing).

5. **Rebrand to "MintBundle".**
   **Accepted.** All three checks clean:
   - `apps.shopify.com/mintbundle` returns 404 (slug free).
   - `mintbundle.com` not registered.
   - `mintbundle.app` not registered.

   Loses the "Forge" brand DNA but gains a clean App Store path
   with zero collision risk.

## Consequences

### Code-side (this commit)

- 175+ files mechanically renamed (TypeScript, JSON, Markdown, TOML,
  YAML, HTML, CSS, Liquid, GraphQL).
- File path renames: `docs/help/why-bundleforge.md` →
  `why-mintbundle.md`; `extensions/theme-extension/assets/
  bundleforge.css` → `mintbundle.css`; `bundleforge-bundle.js` →
  `mintbundle-bundle.js`.
- Replacements:
  - `BundleForge` → `MintBundle`
  - `Bundleforge` → `MintBundle`
  - `bundleforge` → `mintbundle`
  - `BUNDLEFORGE` → `MINTBUNDLE`
- Domain references (`bundleforge.app` → `mintbundle.app`) updated
  in code; user must register the new domain (see user-action doc).

### User-side actions required (separate from this commit)

See `docs/ops/rebrand-handoff.md`. Summary:

1. Register domains: `mintbundle.app`, ideally `mintbundle.com` too.
2. Cloudflare DNS: point at Railway (mirror current
   bundleforge.app setup).
3. Partner Dashboard: create a new app named "MintBundle" — do NOT
   rename the existing draft. Get fresh `client_id` + `client_secret`.
4. `shopify.app.toml` already has the new name + URL; only the
   `client_id` field needs to be updated post-creation.
5. Railway env: update `SHOPIFY_API_KEY`, `SHOPIFY_API_SECRET`,
   `SHOPIFY_APP_URL` (= `https://app.mintbundle.app`).
6. Resend: new sending domain `mail.mintbundle.app` (mirror current
   `mail.bundleforge.app` DNS records).
7. Workspace: add `support@mintbundle.app` alongside (or replacing)
   `support@bundleforge.app`.
8. `npx shopify app deploy` to push Functions + Theme Extensions
   under the new app's client_id.
9. Optional: sell `bundleforge.app` to JRL Software (₹15k recovery
   target); else 301-redirect to `mintbundle.app`.

### Tests / typecheck

902/915 vitest pass after the rename pass. Typecheck clean.
The existing test assertions on shop-name strings, email
templates, and copy strings auto-followed the rename because the
strings live in source-of-truth files (templates, plan registry).

### Brand strategy

"Mint" connotes freshness, recency, and value (newly-minted coins).
Pairs with our "13 bundle types + reliable inventory + flat-rate
pricing" positioning. Tagline rewrites:

- Old: "BundleForge — forge product bundles"
- New: "MintBundle — bundle commerce, freshly minted"

Marketing tone, color palette, and design system can stay; the
"forge / craftsman" metaphor was a brand veneer, not a load-bearing
strategy element.

## Reversal

This decision is reversible only via another ADR + full code
rebrand pass. Domain registration is the only sunk cost (~₹15k for
`bundleforge.app` already paid; ~$50/yr for `mintbundle.app` going
forward).
