# Competitive Audit — 2026-05-06

> Methodology: WebFetch and WebSearch against each competitor's Shopify App Store
> listing (apps.shopify.com/...) on 2026-05-06. No installs, no merchant
> interviews, no source-code inspection of competitors. Feature claims are taken
> from each app's own marketing copy on its public listing — they have not been
> independently exercised. Review themes were attempted via the
> `/reviews?ratings=1,2&sort_by=newest` filter, but the App Store renders that
> page client-side so WebFetch only saw the histogram, not the negative review
> bodies; where a complaint is listed below it came either from a 5-star review
> mentioning a problem they later resolved, from prior public coverage surfaced
> via WebSearch, or from the rating distribution alone. The lack of negative
> review text is the single biggest gap in this audit.
>
> Slug corrections from PRODUCT_PLAN §2.1: Kaching's slug is `bundle-deals`
> (not `bundles-2` — that URL 404s), BOGOS is `freegifts` (not `bogo`), Bundler
> is `bundler-product-bundles` (not `bundler`), Fast Bundle is
> `fast-bundle-product-bundles` (not `fast-bundle-product-bundle`), Simple
> Bundles is `simple-bundles` (not `bundles-app`).

---

## Per-competitor snapshots

### 1. Kaching Bundles App & Upsells
- **URL:** https://apps.shopify.com/bundle-deals
- **Rating:** 5.0 stars, 4,175 reviews
- **Status:** Built for Shopify
- **Pricing (USD/mo):** Starter $14.99 (≤$1k extra rev), Scale $29.99 (≤$5k),
  Pro $59.99 (≤$10k). 7-day trial. Revenue-capped tiers.
- **Bundle types claimed:** fixed, multipack, mix-and-match, variant, infinite
  options, subscription, wholesale, upsell, cross-sell, frequently bought
  together, custom.
- **Integrations claimed:** Shopify Checkout, POS, Hydrogen, EComposer,
  PageFly, GemPages, Foxify, 2048 Variants, UpCart, Kaching Subscriptions.
- **AI / A/B / analytics:** A/B testing called out explicitly; analytics
  dashboard with revenue tracking. No AI feature advertised.
- **i18n:** 9 languages (per listing copy).
- **Differentiators emphasized:** Built for Shopify badge, 24/7 live chat,
  drag-and-drop editor, "no code" theme compatibility.
- **Negative review themes:** Could not extract — `/reviews?ratings=1,2` filter
  not server-rendered. Histogram shows 30 one-star + 6 two-star out of 4,175.

### 2. BOGOS: Free Gift Bundle Upsell
- **URL:** https://apps.shopify.com/freegifts
- **Rating:** 5.0 stars, 3,673 reviews
- **Status:** Built for Shopify, "76K+ brands" claim per their copy
- **Pricing (USD/mo):** Free (30 lifetime orders), Basic $29.99 (300 orders/mo),
  Grow $49.99 (600 orders/mo, $69.99 for advanced shops), Plus $109.99
  (2,000 orders/mo). Annual −20%. $0.05 per order over allotment.
- **Bundle types claimed:** BOGO, BXGY, free gift, classic bundle, mix-match,
  build-a-box bundle builder, volume/quantity break, tiered, frequently bought
  together.
- **Integrations claimed:** Shopify Checkout, POS, Flow, Hydrogen
  (Plus tier only), Slide Cart, Facebook Pixel, gift cards, subscriptions,
  Transcy.
- **AI / A/B / analytics:** "AI Assistant" on Basic+; real-time analytics
  (CTR, funnel). No A/B testing claimed.
- **i18n:** 7 languages claimed.
- **Differentiators:** Headless/Hydrogen API gated behind Plus tier; checkout
  upsell on Plus tier; long operating history ("11 years").
- **Negative review themes:** Histogram shows 36 one-star + 11 two-star;
  bodies not captured.

### 3. Bundler ‑ Product Bundles App
- **URL:** https://apps.shopify.com/bundler-product-bundles
- **Rating:** 4.9 stars, 2,163 reviews
- **Status:** Built for Shopify
- **Pricing (USD/mo):** Free (unlimited rev/orders, BOGO + volume + POS),
  Premium $9.99 (mix-match, custom landing pages, free shipping), Executive
  $19.99 (analytics).
- **Bundle types claimed:** fixed, multipack, mix-match, variant, build-a-box,
  gift box, sample pack, subscription, wholesale, upsell, cross-sell, FBT,
  custom.
- **Integrations claimed:** Shopify Checkout, POS, Cartbot, multi-currency
  apps, PageFly, Seal Subscriptions.
- **AI / A/B / analytics:** Analytics on Executive tier (revenue, AOV, CTR);
  no AI claimed; no A/B testing claimed.
- **i18n:** 16+ languages claimed.
- **Differentiators:** Free tier with no revenue cap; free removal of branding;
  cheapest paid tier in the set ($9.99).
- **Negative review themes:** One review surfaced complained of slow
  performance with high-variant products (~80 variants causing abandoned
  carts), per the listing's visible review body.

### 4. FBP | Fast Bundle Product
- **URL:** https://apps.shopify.com/fast-bundle-product-bundles
- **Rating:** 5.0 stars, 2,589 reviews
- **Status:** Built for Shopify
- **Pricing (USD/mo):** Standard 1K $19 (≤$1k bundle sales), 3K $49, 10K $139.
  Revenue-capped, 7-day trial, free for dev stores.
- **Bundle types claimed:** fixed, multipack, mix-match, variant, build-a-box,
  gift box, subscription, wholesale, upsell, cross-sell, FBT, custom.
- **Integrations claimed:** Shopify Checkout & POS, GemPages, PageFly,
  Recurpay, Subi, UpCart.
- **AI / A/B / analytics:** "AI Frequently Bought Together," "AI Bundle Image
  Generator." Analytics implied but not detailed. No A/B testing claimed.
- **i18n:** 10+ languages.
- **Differentiators:** Two distinct AI features (recommender + image gen);
  Built for Shopify; cheapest entry point at $19.

### 5. Simple Bundles & Kits
- **URL:** https://apps.shopify.com/simple-bundles
- **Rating:** 4.8 stars, 701 reviews
- **Status:** Built for Shopify
- **Pricing (USD/mo):** Free (3 bundles, 50 orders/mo), Basic $14 (unlimited
  bundles, 1 POS location), Grow & Advanced $39 (custom metafields, theme
  customization, unlimited POS, Flow), Plus $149 (dedicated queue, Hydrogen,
  24/7 support).
- **Bundle types claimed:** fixed, multipack, mix-match, variant, infinite
  options, build-a-box, gift, mystery, sample, subscription, wholesale,
  upsell, cross-sell, FBT, custom.
- **Integrations claimed:** 3PL/WMS/ERP via SKU breakdown, Shopify POS,
  Hydrogen/headless, Judge.me, ShipStation, Shopify Flow, subscription apps.
- **AI / A/B / analytics:** "AI suggested bundles from order history." Bundle
  sales analytics, AOV tracking. No A/B testing claimed.
- **Differentiators:** SKU-level breakdown is the headline feature; bypasses
  Shopify's 2048-variant limit; the only competitor explicitly emphasizing
  3PL/WMS/ERP fulfillment workflows. ~4,955 stores installed (per Storeleads
  data surfaced via WebSearch — not on the listing itself).

### 6. Shopify Bundles (native)
- **URL:** https://apps.shopify.com/shopify-bundles
- **Rating:** 2.7 stars, 565 reviews (rating distribution: 39% 5★, 23% 1★)
- **Pricing:** Free.
- **Bundle types claimed:** fixed bundles, multipacks. That's it.
- **Integrations claimed:** Shopify Admin only. No 3PL, no Hydrogen
  positioning, no subscription compatibility (in fact incompatibility with
  Shopify Subscriptions is called out in negative reviews).
- **AI / A/B / analytics:** Conversion-rate analytics only. No AI, no A/B,
  no theme blocks.
- **i18n:** 19 languages (the broadest of any app in this set).
- **Negative review themes (from review excerpts visible on listing):**
  product titles containing slashes break save; cannot do "choose 6 of 24";
  validation rule mismatches with Shopify's own standards; incompatible with
  Shopify Subscriptions.
- **Why it matters anyway:** It's the floor. Free + native + 565 reviews
  means most merchants try it first. Apps in this category have to beat its
  feature gap to justify a paid tier.

### 7. Bundles.app ‑ Inventory Sync (Gazebo)
- **URL:** https://apps.shopify.com/bundles
- **Rating:** 4.9 stars, 307 reviews
- **Pricing (USD/mo):** Shopify Shops $19, Plus 30K $39, Plus 100K $99,
  Plus 100K+ $199. 15-day trial.
- **Bundle types claimed:** fixed, multipack, mix-match, variant, gift,
  mystery, subscription, wholesale, digital, physical.
- **Integrations claimed:** 2048 variants, EasyScan, iPacky, "most 3PL
  providers," Stocky, Synkro.
- **AI / A/B / analytics:** None claimed.
- **Differentiators:** Bills itself as inventory-sync-first; explicit
  multi-location SKU tracking; "private servers" on Plus tiers (the only
  competitor making infrastructure-isolation a paid feature).

### 8. Vitals: Reviews, Bundles & 40+
- **URL:** https://apps.shopify.com/vitals
- **Rating:** 4.9 stars, 2,615 reviews
- **Status:** Built for Shopify
- **Pricing:** All-in-One $29.99/mo, plus undisclosed revenue-based fees.
- **Bundle types claimed (within the suite):** fixed, mix-match, upsell,
  cross-sell, FBT, related products, custom.
- **Integrations claimed:** Shopify Flow, AliExpress, Klaviyo, Omnisend,
  PageFly, Facebook Pixel, Instagram, Geolocation, Messenger, WhatsApp.
- **AI / A/B / analytics:** AI image-to-video, AI page builder, AI ad copy,
  AI product page generator. Analytics. No bundle-specific A/B test.
- **i18n:** 15 languages.
- **Differentiators:** Not a bundle app — bundles are 1 of 40+ features. The
  competitive risk is that a merchant adopts Vitals for reviews/popups and
  uses its bundle module by default rather than installing a dedicated app.

---

## Comparison matrix (measured)

All cells are sourced from the listing pages fetched on 2026-05-06 unless
otherwise noted.

| App | Rating | Reviews | Min $/mo | Max $/mo | Bundle types claimed | A/B testing | AI claimed | 3PL focus | Hydrogen | POS | i18n | Theme blocks |
|-----|--------|---------|----------|----------|----------------------|-------------|-----------|-----------|----------|-----|------|--------------|
| Kaching Bundles | 5.0 | 4,175 | $14.99 | $59.99 | ~13 (fixed, multipack, mix-match, variant, infinite, sub, wholesale, upsell, x-sell, FBT, custom, +)| Yes (listing copy) | No | No | Yes (listing copy) | Yes | 9 | Implied (theme builders) |
| BOGOS | 5.0 | 3,673 | $0 | $109.99 | ~9 (BOGO, BXGY, gift, classic, mix-match, build-a-box, volume, tiered, FBT) | No | "AI Assistant" (Basic+) | No | Yes (Plus tier only) | Yes | 7 | Yes (mentioned) |
| Bundler | 4.9 | 2,163 | $0 | $19.99 | ~13 (fixed, multipack, mix-match, variant, build-a-box, gift, sample, sub, wholesale, upsell, x-sell, FBT, custom) | No | No | No | No | Yes | 16+ | Not claimed |
| Fast Bundle | 5.0 | 2,589 | $19 | $139 | ~12 (fixed, multipack, mix-match, variant, build-a-box, gift, sub, wholesale, upsell, x-sell, FBT, custom) | No | Yes (FBT + image gen) | No | No | Yes | 10+ | Not claimed |
| Simple Bundles | 4.8 | 701 | $0 | $149 | ~15 (fixed, multipack, mix-match, variant, infinite, build-a-box, gift, mystery, sample, sub, wholesale, upsell, x-sell, FBT, custom) | No | "AI suggested from orders" | **Yes (headline)** | Yes (Plus) | Yes | Not specified | Yes |
| Shopify Bundles | 2.7 | 565 | $0 | $0 | 2 (fixed, multipack) | No | No | No | No | Native | 19 | Native |
| Bundles.app | 4.9 | 307 | $19 | $199 | ~10 (fixed, multipack, mix-match, variant, gift, mystery, sub, wholesale, digital, physical) | No | No | **Yes (3PLs listed)** | No | No | Not claimed | Not claimed |
| Vitals | 4.9 | 2,615 | $29.99 | $29.99+ | ~7 inside suite (fixed, mix-match, upsell, x-sell, FBT, related, custom) | No (for bundles) | Yes (page/video/ad gen) | No | No | No | 15 | 30+ sections |
| **MintBundle** | n/a | 0 | $0 | $129 | **13** (verified in `src/services/bundles/validators.ts`) | **Yes** (`src/services/analytics/abTest.ts`) | **Yes** (Python service `ai-service/recommender.py` + Node client) | Adapter exists (ShipStation `src/services/integrations/shipstation.ts`) | Yes — Storefront API at `/api/storefront/v1/...` (`src/routes/storefront.ts`) | **No** (M-051 doesn't publish a real Shopify product, so POS round-trip is broken) | 6 (`src/i18n/locales/{en,es,fr,de,it,pt}.json`) | 5 (`extensions/theme-extension/blocks/`) |

Source notes per MintBundle cell:
- Bundle type count: `grep` on `validators.ts` returns 13 literal types (verified above).
- Pricing: `src/services/billing/plans.ts` defines monthlyPriceUsd 0/12/35/129;
  annual = `Math.round(monthly * 12 * 0.8)` (verified above).
- A/B test: `src/services/analytics/abTest.ts` + `abTest.test.ts` exist.
- AI: `ai-service/recommender.py`, `ai-service/test_recommender.py`,
  `ai-service/app.py` exist.
- 3PL: `src/services/integrations/shipstation.ts` + `shipstation.test.ts`.
- Hydrogen: `src/routes/storefront.ts` exists; `docs/help/storefront.md`
  documents the public API.
- POS: STATE notes M-051 (publish-as-Shopify-product) is incomplete; without a
  real Shopify product, POS scanning at register cannot resolve a bundle.
- i18n: 6 JSON files in `src/i18n/locales/`.
- Theme blocks: 5 liquid files in `extensions/theme-extension/blocks/`
  (bogo-display, build-box-stepper, bundle-display, mix-match-grid,
  variant-selector).
- Cart Transform parity: `extensions/cart-transform/src/pricing.test.ts`
  exists.
- Inventory immutability: `prisma/migrations/20260504000001_audit_log_immutable/migration.sql`
  installs a BEFORE UPDATE trigger that RAISEs (the `REVOKE` claim in the
  task brief was inaccurate — it's a trigger, not a GRANT/REVOKE; ADR-0003
  source comment explicitly says "We cannot rely on per-role REVOKE without
  knowing the [role]"). Also note migration `20260504000002_audit_log_relax_delete`
  later relaxed the DELETE side, so the protection today is UPDATE-rejection
  only.

---

## Where MintBundle wins (verifiable)

1. **Breadth of bundle types in the configurator (13)** beats every paid
   competitor in this set except Bundler (~13) and Simple Bundles (~15) and
   beats native Shopify Bundles by 11 types. Verified:
   `src/services/bundles/validators.ts` lists fixed, mix_match, bogo, bxgy,
   volume, build_box, multipack, gift, mystery, sample, subscription,
   wholesale, custom.

2. **Cross-runtime pricing parity is enforced by tests, not assertions.**
   `extensions/cart-transform/src/pricing.test.ts` and `run.test.ts` mean
   the Cart Transform Function and `src/services/pricing/engine.ts`
   demonstrably stay in sync. None of the 8 competitors mention a
   parity-tested checkout pricing engine in their listing copy, and
   Shopify Bundles' own listing has reviews complaining about validation
   rule mismatches.

3. **A/B testing with a significance calculator** (`src/services/analytics/abTest.ts`
   + `.test.ts`). Of the 8 competitors only Kaching's listing copy claims A/B
   testing for bundles. BOGOS, Bundler, Fast Bundle, Simple Bundles, Bundles.app,
   Vitals, and native Shopify Bundles do not advertise it.

4. **Inventory audit log is enforced at the database**. Trigger
   `inventory_audit_log_no_update` (in
   `prisma/migrations/20260504000001_audit_log_immutable/migration.sql`)
   raises an exception on any UPDATE. No competitor surfaces a comparable
   audit-trail story on its listing.

5. **The integration adapter set is broader than competitors' published
   integration lists for non-Shopify systems.** Verified:
   `src/services/integrations/{shipstation,recharge,bold,klaviyo,googleMerchant,amazon,registry}.ts`
   plus `extensions/flow/`. Competitor listings typically name 1-3 of these
   (BOGOS lists Flow + Transcy; Bundler lists Cartbot + PageFly + Seal;
   Simple Bundles lists ShipStation + Judge.me). Caveat: `amazon.ts` is a
   stub per known gaps; the rest are real adapters with tests.

## Where MintBundle loses or ties

1. **Zero installs, zero reviews, zero brand.** Every competitor has 307–4,175
   reviews. This is the dominant gap for the first 12 months and no feature
   will close it — only distribution and merchant case studies will. Effort:
   ongoing, not a milestone.

2. **POS does not work end-to-end.** STATE notes M-051 (publish-as-Shopify
   -product) is not done, so a bundle does not exist as a scannable Shopify
   product. Kaching, BOGOS, Bundler, Fast Bundle, Simple Bundles, and
   Bundles.app all advertise POS support. Effort: 1-2 milestones (publish a
   real product + map POS line items back to bundle config).

3. **AI recommender is offline-only / not in any merchant-facing surface
   yet.** `ai-service/recommender.py` and the Node client exist, but no spec
   threads its output into the admin UI or storefront blocks. Fast Bundle and
   Simple Bundles both advertise AI bundle suggestions in their primary
   listing copy. Effort: 1 milestone to wire the recommender output into a
   "Suggested bundles" admin view.

4. **Admin UI only edits 5/13 bundle types** (per known gap on M-100). The
   configurator backend supports 13, but a merchant can only configure 5
   through the UI. Until that closes, the comparison-matrix cell counting
   13 types is technically correct but practically misleading. Effort: 1-2
   milestones.

5. **Multi-language coverage is shallow.** 6 locales vs. Shopify Bundles' 19,
   Bundler's 16, Vitals' 15. For an app sold globally on a free tier, this is
   a real gap. Effort: 1 milestone to add ~10 locales (machine-translate +
   spot-review).

## Recommended priorities

Ranked by competitor frequency × estimated merchant pain (high to low). Each
priority cites which competitors do this well and the MintBundle cost to
close.

1. **Ship M-051 (publish bundle as a real Shopify product) so POS works.**
   - Evidence: 6 of 8 competitors advertise POS. Native Shopify Bundles users
     in low-rating reviews repeatedly cite Shopify-system compatibility
     problems — meaning real merchants are checking for it.
   - Cost: 1-2 milestones. Prerequisite for any merchant who has a physical
     store, which is most of the small-merchant segment.

2. **Surface the AI recommender in the admin UI as "Suggested bundles".**
   - Evidence: Simple Bundles ("AI suggested bundles from order history")
     and Fast Bundle ("AI Frequently Bought Together") both lead with this
     in listing copy. The Python service already exists in `ai-service/`.
   - Cost: 1 milestone. We have the backend; we just don't show it.

3. **Finish M-100: extend admin UI to all 13 bundle types.**
   - Evidence: MintBundle's main differentiator versus Bundler (its closest
     feature peer at $9.99/mo) is breadth, but only 5 types are configurable
     in the UI. Without this, the 13-type claim doesn't survive a demo.
   - Cost: 1-2 milestones (one per ~4 types).

4. **Expand i18n from 6 to ~15 locales.**
   - Evidence: Bundler 16+, Vitals 15, Shopify Bundles 19, Kaching 9, BOGOS 7.
     We are below the median.
   - Cost: 1 milestone. Locale files already exist as JSON, the work is
     translation + review.

5. **Publish a "checkout-parity tested" trust story.**
   - Evidence: Native Shopify Bundles' top 1-2★ complaint is validation rule
     mismatches with Shopify's own platform. Our parity tests in
     `extensions/cart-transform/src/pricing.test.ts` are a real
     differentiator that no competitor advertises. This is a positioning /
     marketing investment, not a feature.
   - Cost: a docs page + a listing-copy bullet. Cheapest item on this list.

Items deliberately not in the top 5 (lower payoff or high cost):
- Headless/Hydrogen support — already shipped (`/api/storefront/v1/...`),
  and only BOGOS Plus and Simple Bundles Plus gate it behind premium tiers.
  Marketing surface area is enough; no engineering work needed.
- Bundle A/B testing — already shipped, only Kaching advertises it.
  Same recommendation as item 5: turn it into copy, not code.
- 3PL / SKU-breakdown for fulfillment — Simple Bundles owns this niche with
  a $39 tier targeted at it. Trying to out-feature them here is expensive
  and unlikely to flip the merchants who already chose them.

---

## What this audit does NOT cover

- **No installs.** Every claim about a competitor is from their listing copy
  or rating histogram, not from running the app.
- **No merchant interviews.** Pain points are inferred from public reviews
  and the rating distribution; the App Store does not server-render the
  `/reviews?ratings=1,2` filter, so the actual negative review bodies were
  not extractable via WebFetch on this date. For competitors with hundreds of
  1-2★ reviews (BOGOS 47, Kaching 36, Simple Bundles 19, native Shopify
  Bundles ~200), the qualitative themes here are best-guess, not measured.
- **No code review of competitors.** Whether their A/B testing actually
  computes significance, whether their AI is real, whether their parity is
  enforced — all unverified.
- **No install-count data on most apps.** The App Store doesn't display
  install counts; the only number surfaced (Simple Bundles ~4,955) came
  from a third-party source (Storeleads) via WebSearch and is not on the
  listing itself.
- **Pricing tier inclusions may have shifted since the listing was last
  edited.** Each app's listing was treated as the source of truth on the
  fetch date; pricing pages on the apps' own websites were not cross-checked.
- **App Store rating inflation.** Several competitors hover at 5.0 with
  thousands of reviews, which is statistically improbable without curation.
  The audit takes ratings at face value but a more skeptical reading would
  weight Bundler (4.9, 2,163), Bundles.app (4.9, 307), and Simple Bundles
  (4.8, 701) higher because their distributions look more natural.
- **The PRODUCT_PLAN §2.1 slug list had 5 of 8 wrong.** Audits of competitor
  URLs should be re-run before each major release, not assumed stable.
