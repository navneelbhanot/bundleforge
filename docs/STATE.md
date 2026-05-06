# STATE.md — Live Project State

> Updated at the end of every session, in the same commit as the work.

---

## Current milestone

**Phase R2 in progress — Bundle Detail richness.**

M-169 (Detail shell tab refactor) and M-170 (Schedule tab) both
landed 2026-05-06. The Bundle Detail page now has 2 of 8 tabs
fully built: Setup (visually identical to the previous
scrolling form) and Schedule (Window / Recurrence / End
behavior). Remaining R2 tabs (Display, Customers, Inventory,
Performance + Activity, Advanced) are placeholders pointing at
M-171..M-175.

Form state survives tab switches via the display:none toggle
established in M-169. Schedule tab persists `startsAt`,
`endsAt`, `scheduleSettings` (timezone, recurringRule,
endBehavior) on the Bundle row.

Roadmap: `docs/plans/rich-admin-ui-roadmap.md`.

## Exact next action

**User action required (still pending — two migrations queued):**
1. M-168: `prisma/migrations/20260506160000_api_tokens_and_outbound_webhooks/`
2. M-170: `prisma/migrations/20260506180000_bundle_schedule_settings/`

Both safe during normal traffic — M-168 creates 2 empty tables,
M-170 adds a single nullable JSON column to bundles. Apply via
`prisma migrate deploy` from a CI shell.

**Code (next session):** Run M-171 — Display tab content (Bundle
Detail). Spec first: `docs/specs/M-171-bundle-detail-display.md`.
Per-bundle override of the shop-level Display defaults from M-162
(layout / color preset / image preference / Add-to-cart copy /
sold-out behavior / custom CSS). Persists in
`Bundle.displaySettings` (existing JSON column — no migration
needed).

Other open threads (mostly user-owned):

1. **User**: confirm in the Shopify admin that bundle CRUD works
   end-to-end on `devstore-2u6u4fcc.myshopify.com` — create, edit,
   publish, archive. Today only verified install + create-form mount.
2. **User (Railway dashboard)**: fix the worker service
   (`outstanding-nourishment`) — its `startCommand` is
   `npm run start:web`; it should be `npm run start:worker`. Same for
   the `AI Service` (currently FAILED with the wrong start command).
3. **Code**: write the OAuth-flow Playwright test if/when the
   worker/AI surface fixes uncover anything new — the existing
   `tests/integration/auth-flow.test.ts` covers middleware logic but
   not the actual OAuth redirect chain.
4. **User decision**: whether to commission a real competitive
   comparison (replace the speculative table in `PRODUCT_PLAN.md`
   §4 with measured data from each top competitor).

Operational, still user-owned (unchanged from before today):

- Send `legal/privacy-policy.md` and `legal/terms-of-service.md` to
  counsel; fill in `{{placeholder}}` fields.
- Capture screenshots per `docs/launch/screenshots-spec.md`, shoot
  the video per `docs/launch/video-script.md`.
- Walk `docs/launch/submission-checklist.md` end-to-end on the dev
  store, then submit.
- Schedule beta merchants per `docs/onboarding-beta.md`.
- On D-day follow `docs/launch/launch-checklist.md`.

Future code work (post-launch backlog):

- **Real Shopify product sync on publish()** — DONE 2026-05-06.
  publish() now calls productCreate via `defaultCreateShopifyProduct`
  in `src/routes/bundles.ts` and persists the GID + legacy id, with a
  components JSON metafield the Cart Transform reads at checkout.
- **POS integration** — once a Shopify product exists per bundle (now
  true), publish to the POS sales channel via `productPublish` + the
  POS publication ID. Code change is small; deferred until a beta
  merchant actually uses POS.
- **Trial-warning emails** — needed to back the §5 "Billing
  transparency" claim. Needs SMTP wiring + a cron worker job.
- **Prisma v6 → v7** — requires `prisma.config.ts` + adapter rewiring.
  Not blocking launch.
- ResourcePicker integration on `ProductPicker`.
- Theme-extension Playwright tests.
- Amazon SP-API SigV4 (current adapter is a basic stub).
- Datadog statsd wiring in the worker (dashboards reference metric
  names; emit them when production traffic warrants).
- M-126 nightly retraining schedule (AI client + route exist; cron
  entry lands when production ops needs it).
- Analytics materialized views.

## Blockers

- Worker + AI services on Railway have wrong `startCommand`; user must
  fix in the dashboard (CLI cannot edit service-stored startCommand).
  Step-by-step in `docs/runbook-railway.md`.
- POS sales-channel publication blocked by the publish()-creates-
  Shopify-product gap. Documented in Future code work below.

## Carry-overs (still active)

- Cloudflare WAF rule for HMAC abuse — referenced in
  `docs/runbook-incidents.md`; ops provisions when the domain goes
  behind Cloudflare.

## Recently completed

- **M-170 — Bundle Detail · Schedule tab** (2026-05-06 late).
  Three cards: Window (start date+time / end date+time / IANA
  timezone Select), Recurrence (None / Daily / Weekly /
  Monthly with conditional daysOfWeek ChoiceList for weekly +
  dayOfMonth TextField for monthly + per-cycle start/end times),
  End behavior (archive vs pause). Server: new Bundle JSON
  column `scheduleSettings`, validates timezone +
  recurringRule.type/daysOfWeek/dayOfMonth/start-end shapes;
  cross-field guard rejects endsAt < startsAt; deep-merge so a
  Save on one card doesn't drop sibling fields. Migration file
  ready (NOT applied per CLAUDE.md §5). Worker for auto-archive
  / auto-pause at endsAt-passes deferred to M-170b.
  `docs/sessions/0170-bundle-detail-schedule.md`.
- **M-169 — Bundle Detail tab shell refactor** (2026-05-06 late,
  Phase R2 start). The 500-line single-scroll BundleDetailPage
  is now an 8-tab shell (Setup, Schedule, Display, Customers,
  Inventory, Performance, Activity, Advanced) with hash routing.
  Setup tab is visually identical to today's surface; other 7
  tabs render a `PlaceholderTab` Card pointing at their
  follow-on milestone. Form state preservation: the Setup tab's
  4 cards stay mounted with `display: none` when another tab is
  active, so switching tabs never discards in-flight title /
  description / items / pricing-rules edits. Sidebar (Status +
  Quick stats + Live Preview) persists on every tab.
  `docs/sessions/0169-bundle-detail-tab-shell.md`.
- **M-168 — Settings · API & webhooks tab** (2026-05-06 late,
  closes Phase R1). Two new Prisma models (ApiToken,
  OutboundWebhook) with a migration file ready for the next
  deploy. Two CRUD routes: `/api/v1/api-tokens` (create/list/
  revoke) and `/api/v1/outbound-webhooks` (create/update/list/
  delete). Token hashing uses Node's built-in scryptSync — no
  new deps. Plaintext API token and HMAC webhook secret are
  returned exactly once at create; merchant copies before
  closing. Frontend `ApiWebhooksTab` ships with two Polaris
  IndexTables + Add modals; both surfaces include a banner
  flagging M-168b (the worker that emits HTTP POSTs is its own
  ticket — config is ready and waiting today).
  `docs/sessions/0168-settings-api-webhooks.md`.
- **Bundle-order tagging in Shopify** (2026-05-06 late, hotfix
  before M-168). The `orders/create` webhook handler now calls
  Shopify's `tagsAdd` mutation (additive — never clobbers
  existing tags) to mark every bundle-containing order with
  `bundleforge`, `bundle`, and `bundle: <title>`. Merchants can
  filter their Shopify Orders list by these tags. Failure to
  tag is logged but never fails the webhook — the BundleOrder
  row is already persisted by then, so a missing tag is a UI
  nuisance not a data integrity bug. 541/541 vitest pass.
- **M-167 — Settings · Localization + Billing + GM feed URL**
  (2026-05-06 late). Re-scoped mid-spec from "API & webhooks +
  Localization + Billing in one milestone" to just the three
  small surfaces — the API & webhooks side was its own
  milestone of work (two new Prisma models + migrations) and
  deferred to M-168. Localization tab covers enabled locales
  (15 options), fallback locale, and a machine-translate
  toggle. Billing tab is an organizational move: extracted the
  inner content of `BillingPage.tsx` into a shared
  `BillingPanel` component used both by the standalone
  `/billing` route and the Settings tab. Google Merchant
  feed URL (deferred from M-166) now renders on the
  Integrations tab as a read-only TextField + Copy button when
  the shop's Shopify domain is known.
  `docs/sessions/0167-settings-localization-billing.md`.
- **M-166 — Settings · Integrations tab** (2026-05-06 late).
  New `/api/v1/integrations` route exposes the adapter registry
  with GET (list all known types joined with shop's persisted
  state, never returns credential values), PUT /:type
  (AES-256-encrypts and persists), POST /:type/test (calls
  adapter.ping() without persisting), DELETE /:type (soft-disable
  + clear creds, keeps row for `lastSyncedAt` history).
  Frontend: new `IntegrationsTab.tsx` component renders one Card
  per known adapter (ShipStation, Recharge, Bold, Klaviyo,
  Amazon, Google Merchant) with status badge + Configure modal.
  Modal has masked TextFields per credential key, Test
  connection / Save / Disconnect actions, and "leave blank to
  keep" behavior so partial updates work.
  `docs/sessions/0166-settings-integrations.md`.
- **M-165 — Settings · Notifications & alerts tab** (2026-05-06
  late). Three cards: Channels (Polaris Tag chips for email
  recipients with Add input + remove, Slack and Teams webhook
  URL fields, in-app checkbox), Email channel (master enable
  toggle re-surfacing the existing setting + helpful copy when
  no recipients are configured), Alert rules (5 rules × 4
  channels each via ChoiceList allowMultiple). Server upgraded
  notifications schema from `{email,inApp}` to a structured
  tree, with two-level deep-merge so saving one rule doesn't
  drop sibling rules. Existing `email`/`inApp` toggles kept
  working unchanged. Wiring: emitters that already exist will
  multiplex to channels in M-165b; events without an emitter
  today persist their config until built.
  `docs/sessions/0165-settings-notifications.md`.
- **M-164 — Settings · Cart & Checkout tab** (2026-05-06 late).
  Two cards: Cart mode (bundle_as_product /
  components_as_attributes Select with merchant-friendly
  explainer) and Checkout protections (atomic enforcement
  strict/warn/off, abandonment behavior keep/clear/prompt,
  optional cart-line note template max 280 chars with
  `{bundle_title}`/`{components_count}` placeholders). Cart
  Transform Function in `extensions/cart-transform/src/run.js`
  now reads an optional shop metafield
  `bundleforge.cart_default_mode` and skips the expand path
  when it's `components_as_attributes` — defaults
  fall back to today's behavior so absent metafield = no
  regression. Writing the metafield from admin Save lands in
  M-164b. `docs/sessions/0164-settings-cart-checkout.md`.
- **M-163 — Settings · Inventory + Pricing tabs** (2026-05-06
  late). Two tabs in one milestone (each was small enough that
  splitting would have created an empty session). Inventory tab
  has Stock guards card (safetyLock re-surfaced, low-stock
  threshold, oversell policy, low-stock alert toggle) and Audit
  & snapshots card (retention days 7..3650, snapshot frequency).
  Pricing tab has Rounding & formatting card (rule + currency
  formatter override) and Defaults for new bundles card
  (default discount type + B2B markup -100..1000%). Server adds
  `settings.inventory` and `settings.pricing` Zod-validated
  subobjects. safetyLock stays at top-level for backwards
  compat with the existing webhook handler.
  `docs/sessions/0163-settings-inventory-pricing.md`.
- **M-162 — Settings · Display tab** (2026-05-06 late). Display
  tab in SettingsPage now ships fully built: Layout/visual style
  card (layout grid/list/carousel + colorPreset enum), Imagery &
  copy card (image preference, Add-to-cart copy with 40-char limit
  + counter, sold-out behavior), Custom CSS card (8000-char
  textarea, monospaced, soft brace-mismatch banner). Server:
  `settings.display` Zod-validated subobject with the same
  deep-merge as `general`; new `mergeSubobject` helper keeps the
  PUT path DRY. Theme blocks reading these defaults is deferred
  to M-162b. `docs/sessions/0162-settings-display-tab.md`.
- **M-161 — Settings shell + General tab** (2026-05-06 late). The
  107-line two-toggle SettingsPage was replaced with a 10-tab shell
  (General, Display, Inventory, Pricing, Cart & checkout,
  Notifications, Integrations, API & webhooks, Localization,
  Billing) with hash-routed navigation. General tab ships fully
  built (Shop card read-only from session, Brand card with hex color
  + logo URL, Defaults card with currency/locale/timezone). Server
  schema namespaces options under `settings.general` and deep-merges
  on PATCH so per-card Save buttons don't wipe each other.
  `docs/sessions/0161-settings-shell-general.md`.
- **Editable PricingRulesEditor** (2026-05-06 late). Replaced the
  read-only IndexTable with one Card per rule containing real
  Select / TextField / Checkbox controls. Add now defaults to a
  percentage rule at 10. Empty state with EmptyState. Tests grew
  from 2 to 6.
- **Competitive-audit gap closures** (2026-05-06 late). Cart Transform
  Function now reads `bundleforge.is_bundle` and
  `bundleforge.components` product metafields and emits an `expand`
  operation that swaps a bundle product line for one line per
  component variant. publish() in `src/services/bundles/index.ts`
  passes items + pricing rules through to the Shopify productCreate
  hook so `defaultCreateShopifyProduct` writes the components JSON
  metafield (schemaVersion 1). New `AiSuggestionsPage` admin page
  consumes `/api/v1/ai/suggested-bundles` and pre-fills the create
  flow with the AI-recommended SKU pair. M-100 TypeConfigPanel now
  has dedicated read-only display for all 13 bundle types (8 added:
  bogo, bxgy, volume, gift, mystery, sample, subscription, custom).
  i18n ships 9 new locales (ja, zh, ko, nl, pl, sv, da, no, ru) for
  15 total. `docs/help/why-bundleforge.md` published as the trust
  story for the App Store listing.
- **Visual UI revamp + sidebar nav fix** (2026-05-06 evening).
  Card-grid bundle type picker with gradient banners (distinct from
  competitor product-photo aesthetic); fresh-shop dashboard centered
  on three differentiator cards (atomic inventory / pricing parity /
  immutable audit log) instead of a generic onboarding checklist;
  stat cards above the bundles table when populated. NavMenu
  switched from React Router `<Link>` to plain `<a>` so App Bridge
  click interception works and the outer admin URL stays in sync.
  6/6 Playwright now (split the wizard test).
  `docs/sessions/0159-ui-revamp-navmenu-typecards.md`.
- **Crisp live chat + Storefront API endpoint + Bundle CRUD e2e test
  + Railway runbook** (2026-05-06 PM). Wired Crisp via env-driven
  meta-tag substitution + lazy loader; added `/api/storefront/v1/`
  public read-only routes for Hydrogen / headless storefronts;
  added a real Postgres-backed Bundle CRUD integration test that
  drives create → list → detail → update → publish → archive plus
  cross-tenant safety; documented Railway worker + AI Service start-
  command fixes in `docs/runbook-railway.md`. Demoted POS in §4 to
  await the publish-creates-Shopify-product gap (separate larger
  task — see Future code work below).
- **PRODUCT_PLAN audit + UI polish + null-safe pages + OnboardingWizard
  wiring + merchant help docs** (2026-05-06). Replaced the bare
  `<Link>` nav with Polaris Tabs; added EmptyState renders to all
  list pages with shape-tolerance against API drift; wired the
  built-but-unused OnboardingWizard into BundlesListPage; demoted
  three vapor claims (POS, Hydrogen, live chat) in PRODUCT_PLAN §4
  to `(roadmap)`; published `docs/help/` (7 files) for merchants.
- **First real Shopify dev-store install + 14 deploy/auth/UI fixes +
  3 new test layers + CI e2e job** (2026-05-05). 17 commits.
  `docs/sessions/0157-first-install-deploy-fixes.md`.
- Railway deploy config + Shopify SDK / Prisma 6 major upgrade +
  `tsx` runtime (ADR-0005). `docs/sessions/0156-railway-and-sdk-upgrade.md`.
- M-150..M-155 — Launch batch (legal templates, demo seed, beta
  onboarding, App Store assets, launch checklist).
  `docs/sessions/0150-launch.md`.
- M-141..M-149 — Hardening (a11y, Sentry audit, Datadog dashboards,
  incident runbook, backup/restore, GDPR endpoints, per-IP rate
  limiter, OpenAPI). `docs/sessions/0141-hardening.md`.
- M-140 — Security review pass + ADR-0004. `docs/sessions/0140-security-review.md`.
- (Earlier history in PLAN.md.)

## Test status

- **582 / 582 vitest tests passing** when DATABASE_URL points at a
  real Postgres. +6 BundleService schedule cases + +5
  ScheduleTab UI cases + +1 BundleDetailPage hash test since
  M-169.
- **454 / 454** when no real DB is available — the bundle CRUD
  integration tests auto-skip via `describe.skipIf`.
- **5 / 5 Playwright e2e tests passing** (unchanged).
- CI runs both layers on every push and PR.
- Typecheck clean (server + frontend).
- Lint: 5 pre-existing errors only; no new violations.

## Working branch

`claude/objective-sinoussi-77ae86` (today's worktree). Main is
fast-forwarded through every commit; CI runs against main.
