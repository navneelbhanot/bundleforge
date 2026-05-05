# STATE.md — Live Project State

> Updated at the end of every session, in the same commit as the work.

---

## Current milestone

**M-141 — Accessibility audit (WCAG AA)**

## Exact next action

Boot phase, then write `docs/specs/M-141-accessibility.md`. Adopt
`eslint-plugin-jsx-a11y` for the frontend, run `axe-core` against the
Polaris pages via Playwright (or RTL + jest-axe), record findings,
fix WCAG-AA violations. Existing pages: BundlesListPage,
BundleDetailPage, OrdersListPage, OrderDetailPage, InventoryAuditPage,
InventoryHealthPage, SettingsPage, BillingPage, AnalyticsOverviewPage,
AbTestsPage.

## Blockers

None.

## Carry-overs (still active)

- npm audit: 3 production findings rooted in `uuid <14` via Shopify
  SDK (we don't call the vulnerable code path). Resolved when the
  Shopify SDK upgrade lands. See ADR-0004.
- Shopify SDK upgrade (api v13, app-express v7, prisma v6,
  session-storage-prisma v9) flagged for ADR before going live.
- ResourcePicker integration on ProductPicker still deferred.
- Theme-extension Playwright tests → M-141.
- Analytics materialized views deferred — M-138/M-139 may revisit.
- Amazon adapter is a basic stub; SP-API SigV4 in a follow-up.
- M-126 retraining schedule (BullMQ nightly job): the AI client and
  route exist; the cron-style schedule lands when production ops needs
  it.

## Recently completed

- M-140 — Security review pass + ADR-0004. `docs/sessions/0140-security-review.md`.
- M-137..M-139 — Property tests (concurrency + throughput + pricing
  invariants). `docs/sessions/0137-property-tests.md`.
- M-131..M-136 — Server-side i18n + 6 locales. `docs/sessions/0131-i18n.md`.
- M-127..M-130 — 4 competitor migration importers. `docs/sessions/0127-migrations.md`.
- M-121..M-126 — Klaviyo + Google Merchant + Flow + AI service.
  `docs/sessions/0121-integrations-ai.md`.
- (Earlier history in PLAN.md.)

## Working branch

`claude/review-product-plan-jfMlf`
