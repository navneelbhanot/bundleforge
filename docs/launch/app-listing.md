# App Store listing copy (M-154)

## App name

**BundleForge — Reliable Product Bundles**

## Tagline (≤80 chars)

The most reliable Shopify bundling app: 13 types, theme-perfect, atomic
inventory.

## Short description (≤120 chars)

Fixed, mix-and-match, BOGO, volume, build-a-box and 8 more bundle types
— with cents-exact pricing and SKU-accurate inventory.

## Long description

> 600-1500 words; below is the canonical version. Update the numbers
> before each launch refresh.

BundleForge is the bundling app Shopify merchants choose when they need
the math to be right. We compute pricing the same way in your theme,
your cart, and at checkout — so the price the shopper sees is the
price they pay. Every time.

### What you can build

- **Fixed bundles** — set a list of products, charge one price.
- **Mix-and-match** — let shoppers pick N items from a curated set.
- **BOGO + Buy-X-Get-Y** — the classics, with stacking rules.
- **Volume + tiered pricing** — buy more, save more.
- **Build-a-box** — multi-step, multi-group, with required + optional
  picks.
- **Multipacks, gift, mystery, sample, subscription, wholesale,
  custom** — eight more types out of the box.

### Why merchants choose BundleForge

- **Pricing parity, not drift.** The same engine runs server-side and
  in Shopify's Cart Transform Function. Cents-exact, banker's-rounded.
  We test it against shared fixtures every commit.
- **SKU-accurate inventory.** Every bundle adjustment is atomic
  (`SELECT … FOR UPDATE`), every move is logged in an append-only
  audit table with database-level UPDATE protection.
- **Storefront-first.** Drop a Theme App Extension block onto any
  Online Store 2.0 theme. No code, no theme edits.
- **Analytics that pay rent.** Revenue per bundle, attach rate,
  conversion deltas, and an A/B testing module with built-in two-
  proportion significance testing.
- **Integrations included.** ShipStation, Amazon FBA, ReCharge, Bold
  Subscriptions, Klaviyo events, Google Merchant feeds, Shopify Flow
  triggers — all in the box.
- **Multi-language.** Server-side i18n in en, es, fr, de, it, pt; the
  storefront block ships in en/es/fr.

### How it stays reliable

- Modular monolith on Node.js + TypeScript. PostgreSQL 16. BullMQ on
  Redis.
- Sentry for errors, Datadog for metrics + logs. Hourly logical
  backups, restore drills quarterly.
- HMAC verification on every webhook + App Proxy call. AES-256-GCM
  encryption at rest for Shopify access tokens.
- 442 automated tests at launch, including property tests for
  inventory concurrency, webhook throughput, and pricing invariants.

### Plans

- **Starter** — 5 bundles, 100 orders / mo. Free.
- **Growth** — unlimited bundles, unlimited orders. $12/mo.
- **Pro** — unlimited + 3PL sync, A/B testing, Shopify Flow. $35/mo.
- **Enterprise** — unlimited + headless storefront, white-label. $129/mo.

Paid plans include a 14-day trial. Annual billing saves 20%.
"Unlimited" is subject to a fair-use clause for paid plans —
[see Terms of Service §3.1](../../legal/terms-of-service.md#31-fair-use-for-unlimited-paid-plans).

### Support

- Docs: https://bundleforge.app/docs
- Email: support@bundleforge.app
- In-app chat for paid plans.

### Privacy + GDPR

We do not collect or sell end-shopper PII. Merchant data exports +
deletes available via `/api/v1/gdpr/*` endpoints. See our [Privacy
Policy](/legal/privacy-policy.md).

## Key benefits (5 bullets, ≤140 chars each)

- **Pricing parity** — same engine in cart, checkout, and your theme.
  Cents-exact, banker's-rounded.
- **SKU-accurate inventory** — atomic adjustments + append-only audit
  log.
- **13 bundle types** — fixed, mix-and-match, BOGO, volume, build-a-
  box, subscription, and more.
- **Storefront block** — drop into any 2.0 theme. No code, no edits.
- **Analytics + A/B** — revenue per bundle, conversion deltas, two-
  proportion significance testing.

## Categories

- Primary: **Selling products → Bundling and discounts**
- Secondary: **Inventory management**

## Integrations to list

ShipStation, Amazon, ReCharge, Bold Subscriptions, Klaviyo, Google
Merchant, Shopify Flow.

## Required URLs

- Privacy: https://bundleforge.app/legal/privacy-policy
- Terms: https://bundleforge.app/legal/terms-of-service
- Support: support@bundleforge.app
- Docs: https://bundleforge.app/docs
