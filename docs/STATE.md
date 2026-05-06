# STATE.md — Live Project State

> Updated at the end of every session, in the same commit as the work.

---

## Current milestone

**Phase R3 in progress — Bundle List richness.**

M-176 + M-177 landed 2026-05-06. The bundle list page now
wraps Polaris IndexFilters around the table: live debounced
search, status + type chip filters, saved views, **and bulk
actions** (publish / archive / delete) on selectable rows.
Bulk endpoints loop the existing single-bundle service
methods sequentially, capture per-id outcomes
(`{succeeded[], failed[]}`), and surface results via a Toast.

M-178 (sort + view modes + true pagination) and M-179
(templates gallery) remaining.

Roadmap: `docs/plans/rich-admin-ui-roadmap.md`.

## Exact next action

**User action required (five migrations queued):**
1. M-168: `prisma/migrations/20260506160000_api_tokens_and_outbound_webhooks/`
2. M-170: `prisma/migrations/20260506180000_bundle_schedule_settings/`
3. M-172: `prisma/migrations/20260506200000_bundle_eligibility/`
4. M-173: `prisma/migrations/20260506220000_bundle_inventory_rules/`
5. M-174: `prisma/migrations/20260506240000_bundle_activity_log/`

All five safe during normal traffic — M-168/M-174 create new
tables, M-170/M-172/M-173 each add a single JSON column to
bundles defaulting to `{}`. Apply via `prisma migrate deploy`
from a CI shell.

**Code (next session):** Run M-178 — Bundle list sort + view
modes + true pagination. Spec first:
`docs/specs/M-178-bundle-list-sort-view-modes.md`. Wires the
Polaris `IndexFilters` `sortOptions` slot to the existing
server-side sort (sortBy=createdAt|updatedAt|title|priority,
sortOrder=asc|desc) and exposes view modes (table / card /
compact). Replaces today's `limit=100` truncation footer with
a real `Pagination` component that drives `page=N&limit=20`
through the existing service surface. Saved views persist
the chosen sort + view mode alongside filters (the M-176
schema already accepts a `sort` sub-object — no new
validator). Sizing: medium.

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

- **M-177 — Bundle list · bulk actions** (2026-05-06 late).
  Plugs row selection + Polaris IndexFilters' promoted
  bulk-action slot into the chrome from M-176. Three new
  server routes —
  `POST /api/v1/bundles/bulk/{publish,archive,delete}` —
  loop the existing single-bundle service methods
  sequentially, capture per-id outcomes
  (`{succeeded: string[], failed: Array<{id, reason}>}`),
  and return 200 / 207 / 422 based on the mix. Cap of 50
  ids/request keeps Shopify Admin GraphQL rate limits
  happy on the publish path. Bulk publish reuses the same
  session-bound `onCreateProduct` hook from M-051. Activity
  log writes are emitted by the existing service methods
  (M-174 added the writers) — no duplication. Frontend
  uses `useIndexResourceState` for selection, a confirm
  modal for archive + delete, and a Toast summary like
  "Published 12 bundles" or "Published 10, 2 failed".
  Route ordering in bundles.ts had to be adjusted: bulk
  routes register before `/:id/*` matchers because Express
  matches in registration order.
  `docs/sessions/0177-bundle-list-bulk-actions.md`.
- **M-176 — Bundle list · IndexFilters + saved views**
  (2026-05-06 late, **Phase R3 start**). Replaced the bare
  IndexTable on `BundlesListPage` with Polaris `IndexFilters`
  wrapping a new `BundlesListTable` component. Live debounced
  search + status / type chip filters call /api/v1/bundles
  with the appropriate query string. Saved views persist via
  a new `savedViews` array on `Shop.settings` (no new schema
  column — piggybacks on the existing settings JSON);
  whole-array replace semantics with max 20 views/shop, label
  1..40 chars, status enum bounded to draft|active|archived.
  Stats strip reflects the filtered result set (Total
  relabels to Filtered when chips are active). Fresh-shop
  branch + OnboardingWizard preserved. Sets the IndexFilters
  chrome that M-177..M-179 plug into.
  `docs/sessions/0176-bundle-list-indexfilters.md`.
- **M-175 — Bundle Detail · Advanced tab** (2026-05-06 late).
  **Closes Phase R2.** Three cards on the previously-blank
  Advanced tab. Search engine listing wires `seoTitle` and
  `seoDescription` columns (in the schema since M-009 but
  never reachable from admin); 60/320 char limits with live
  counters and error messages; empty string normalises to
  `null` server-side. Raw configuration is a Polaris
  `Collapsible` of pretty-printed JSON for the 5 per-bundle
  JSON columns — useful for support-ticket attachments.
  Danger zone exposes Duplicate (calls existing
  `POST /:id/duplicate` and navigates to the new bundle) and
  Delete (typed-confirmation modal — merchant must type
  `DELETE` — calls existing `DELETE /:id` soft-delete).
  Service activity-log writer emits `seo_updated` on SEO
  patches. PlaceholderTab component removed: every tab is
  now wired.
  `docs/sessions/0175-bundle-detail-advanced.md`.
- **M-174 — Bundle Detail · Performance + Activity log tabs**
  (2026-05-06 late). Two tabs in one milestone. Performance is
  read-only against `/api/v1/analytics/bundles/:id` (M-112) and
  renders a KPI strip (Views / Add-to-cart / Purchases /
  Revenue / Conversion rate / AOV) plus per-event-type
  breakdown. Activity is a new merchant-action audit trail:
  new `bundle_activity_log` Prisma model + migration,
  append-only repo, and writers in
  `BundleService.publish/archive/softDelete/update` that emit
  one row per affected section (so a single PUT updating both
  display + eligibility produces two rows). Failures in the
  log writer are best-effort — they warn and swallow rather
  than failing the underlying mutation. New
  `GET /api/v1/bundles/:id/activity` paginates newest-first
  with the standard envelope shape. Frontend uses Polaris
  `Pagination` + tone-aware action badges + relative timestamps
  with absolute time on hover.
  `docs/sessions/0174-bundle-detail-performance-activity.md`.
- **M-173 — Bundle Detail · Inventory tab** (2026-05-06 late).
  Per-bundle override layer for the shop-level Inventory
  defaults from M-163 plus two new bundle-specific rules.
  Three cards: Low-stock thresholds (lowStockThreshold,
  pauseWhenComponentBelow, lowStockAlertEnabled), Oversell
  policy (Select with "Use shop default" sentinel),
  Bundle rendering mode (componentOnlyMode checkbox + info
  banner). New `Bundle.inventoryRules` JSON column with
  migration. Server `validateInventoryRules` enforces 0..100000
  integer bounds (matches M-163's shop-level constraint) and
  the `prevent | allow_negative | allow_to_zero` enum. Same
  null-removes-key semantics as M-171/M-172: blank number
  fields and "Use shop default" Select save as `null`, the
  deep-merge in update() deletes the key, the storefront falls
  back to the shop default at render time. M-173b will wire
  the Cart Transform Function + theme blocks to honor
  `pauseWhenComponentBelow` and `componentOnlyMode` via a new
  `bundleforge.inventory_rules` product metafield.
  `docs/sessions/0173-bundle-detail-inventory.md`.
- **M-172 — Bundle Detail · Customers tab** (2026-05-06 late).
  Per-bundle eligibility surface: tag-based allow/deny chips,
  Shopify Segment GID multiline input, requireLogin checkbox,
  market multi-select (30 ISO codes), locale multi-select (15
  supported locales). New `Bundle.eligibility` JSON column with
  migration. Server `validateEligibility` enforces 2-letter
  uppercase market codes, supported-locale membership, max 50
  tags, max 20 segments. Same null-removes-restriction
  semantics as M-171 Display: empty arrays save as `null`,
  the deep-merge in update() deletes the key, the storefront
  stops gating that dimension. M-172b will wire the Cart
  Transform Function + theme blocks to read the eligibility
  blob via a new `bundleforge.eligibility` product metafield.
  `docs/sessions/0172-bundle-detail-customers.md`.
- **M-171 — Bundle Detail · Display tab** (2026-05-06 late).
  Per-bundle override layer for the shop-level Display defaults
  from M-162. Three cards: Layout & visual style (layout +
  colorPreset Selects), Imagery & copy (imagePreference,
  Add-to-cart copy with 40-char limit, sold-out behavior),
  Custom CSS (8000-char monospaced textarea + brace-mismatch
  warning). Each Select includes a "Use shop default" option
  that sends `null` to the server. The update() merge logic
  treats `null` as "remove this override" — `delete merged[k]` —
  so the storefront falls back to the shop default at render
  time. helpText on every control surfaces what the merchant
  is currently inheriting. No new schema column (uses existing
  `Bundle.displaySettings` JSON). Theme block consumption of
  the override layer deferred to M-171b.
  `docs/sessions/0171-bundle-detail-display.md`.
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

- **659 / 659 vitest tests passing** when DATABASE_URL points at a
  real Postgres. +6 server bulk-route cases + +2
  BundlesListTable selectable cases + +1 BundlesListPage
  bulk-handler case since M-176.
- **509 / 509** when no real DB is available — the bundle CRUD
  integration tests auto-skip via `describe.skipIf`.
- **5 / 5 Playwright e2e tests passing** (unchanged).
- CI runs both layers on every push and PR.
- Typecheck clean (server + frontend).
- Lint: 6 pre-existing errors only; no new violations.

## Working branch

`claude/objective-sinoussi-77ae86` (today's worktree). Main is
fast-forwarded through every commit; CI runs against main.
