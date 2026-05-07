# PLAN.md — Milestone Roster

> The complete sequence of milestones from foundations through public launch.
> Each row is intended to fit in a single Claude Code session per the sizing
> rules in `CLAUDE.md` §4. Status flips happen in the same commit as the work.
>
> **Status legend:** `pending` · `in_progress` · `done` · `blocked` · `deferred`
>
> Specs live in `docs/specs/M-NNN-<slug>.md`. They are written **before**
> implementation begins.

---

## Phase A — Foundations (M-001 to M-015)

| ID | Title | Status | Spec | Notes |
|----|-------|--------|------|-------|
| M-001 | Env validation + secrets bootstrap | done (2026-05-04) | `docs/specs/M-001-env-bootstrap.md` | Zod schema, `.env.example` refresh, `src/config/env.ts`, vitest config, 19 tests |
| M-002 | Encryption utility (AES-256-GCM) + tests | done (2026-05-04) | `docs/specs/M-002-encryption.md` | v1 wire format, env-keyed, 20 tests |
| M-003 | Logger config (pino) + structured logging | done (2026-05-04) | `docs/specs/M-003-logger.md` | Pino w/ pretty in dev; child() pattern; 5 tests |
| M-004 | Prisma client init + connection pooling | done (2026-05-04) | `docs/specs/M-004-prisma-client.md` | Pino-logged events, slow-query warn, lifecycle helpers |
| M-005 | Redis + BullMQ client init | done (2026-05-04) | `docs/specs/M-005-redis-bullmq.md` | ioredis singleton, queues module, backoffMs |
| M-006 | Express server scaffold + `/health` + tests | done (2026-05-04) | `docs/specs/M-006-server-scaffold.md` | createApp factory, /health pings DB+Redis with timeout, supertest |
| M-007 | Error handler middleware + tests | done (2026-05-04) | `docs/specs/M-007-error-handler.md` | Typed taxonomy, requestId, ZodError mapping, Sentry seam |
| M-008 | Rate limiter middleware + tests | done (2026-05-04) | `docs/specs/M-008-rate-limiter.md` | Redis or memory adapter, plan-aware, RateLimitError integration |
| M-009 | Initial Prisma migration generated (offline) | done (2026-05-04) | `docs/specs/M-009-initial-migration.md` | init.sql + audit-log immutability triggers; apply at M-014 |
| M-010 | Prisma seed script | done (2026-05-04) | `docs/specs/M-010-seed.md` | 1 shop + 3 bundles (fixed/build_box/volume) + billing sub |
| M-011 | CI workflow: typecheck | done (2026-05-04) | `docs/specs/M-011-ci-typecheck.md` | Three parallel jobs; .npmrc legacy-peer-deps |
| M-012 | CI workflow: lint + ESLint v9 flat config | done (2026-05-04) | `docs/specs/M-012-eslint.md` | typescript-eslint flat config, ESM, permissive |
| M-013 | CI workflow: test | done (2026-05-04) | `docs/specs/M-013-ci-test.md` | Postgres+Redis services, migrate deploy, npm test |
| M-014 | docker-compose for local dev | done (2026-05-04) | `docs/specs/M-014-docker-compose.md` | postgres:16 + redis:7; runbook updated; Dockerfile fix |
| M-015 | Sentry integration + tested error capture | done (2026-05-04) | `docs/specs/M-015-sentry.md` | No-op when DSN unset; wired to M-007 seam |

## Phase B — Shopify Integration (M-016 to M-030)

| ID | Title | Status | Spec | Notes |
|----|-------|--------|------|-------|
| M-016 | Shopify CLI app config validation | done (2026-05-04) | `docs/specs/M-016-shopify-app-config.md` | Scopes aligned; runbook documents user setup |
| M-017 | OAuth install route | done (2026-05-04) | `docs/specs/M-017-oauth-install.md` | shopifyApp wrapper, `/api/auth` mounted, redirect verified |
| M-018 | OAuth callback + token persistence | done (2026-05-04) | `docs/specs/M-018-oauth-callback.md` | persistShop pure fn; encrypted token via M-002 |
| M-019 | Session middleware (`requireShopSession`) | done (2026-05-04) | `docs/specs/M-019-session-middleware.md` | Session/header/query precedence; 401 on uninstall |
| M-020 | Prisma-backed session storage adapter | done (2026-05-04) | `docs/specs/M-020-prisma-session.md` | PrismaSessionStorage in prod, memory in tests |
| M-021 | App Bridge token verification | done (2026-05-04) | `docs/specs/M-021-app-bridge.md` | validateAuthenticatedSession + requireShopSession on /api/v1 |
| M-022 | GraphQL Admin API client wrapper | done (2026-05-04) | `docs/specs/M-022-graphql-client.md` | Throttle retry, Pino logging, DI for tests |
| M-023 | REST Admin API client wrapper | done (2026-05-04) | `docs/specs/M-023-rest-client.md` | 429 retry, DI; fallback for non-GraphQL endpoints |
| M-024 | Webhook HMAC verifier middleware | done (2026-05-04) | `docs/specs/M-024-webhook-hmac.md` | Raw-body capture + timingSafeEqual; 401 on mismatch |
| M-025 | Webhook dispatcher → BullMQ | done (2026-05-04) | `docs/specs/M-025-webhook-dispatcher.md` | webhooksQueue + topic-as-name + dedup via webhookId |
| M-026 | Webhook handler: `app/uninstalled` + handler registry | done (2026-05-04) | `docs/specs/M-026-app-uninstalled.md` | webhooksWorker + dispatch + appUninstalled handler |
| M-027 | Webhook handler: `shop/update` | done (2026-05-04) | `docs/specs/M-027-shop-update.md` | Reconciles M-018 placeholder fields |
| M-028 | Mandatory webhook: `customers/data_request` | done (2026-05-04) | `docs/specs/M-028-customers-data-request.md` | Ack-only; no PII stored |
| M-029 | Mandatory webhook: `customers/redact` | done (2026-05-04) | `docs/specs/M-029-customers-redact.md` | Ack-only; no PII stored |
| M-030 | Mandatory webhook: `shop/redact` | done (2026-05-04) | `docs/specs/M-030-shop-redact.md` | Cascade delete; ADR-0003a relaxes audit-log DELETE trigger |

## Phase C — Billing (M-031 to M-038)

| ID | Title | Status | Spec | Notes |
|----|-------|--------|------|-------|
| M-031 | Plan registry (full) | done (2026-05-04) | `docs/specs/M-031-plan-registry.md` | Annual prices, trial days, PLAN_FEATURES per tier |
| M-032 | Billing: `appSubscriptionCreate` | done (2026-05-04) | `docs/specs/M-032-app-subscription-create.md` | mutation + BillingSubscription upsert |
| M-033 | Billing webhook: subscription status sync | done (2026-05-04) | `docs/specs/M-033-subscription-sync.md` | app_subscriptions/update -> BillingSubscription |
| M-034 | Billing service: cancel + plan change | done (2026-05-04) | `docs/specs/M-034-cancel-and-change.md` | cancelSubscription + changePlan |
| M-035 | Annual billing 20% discount | done (2026-05-04) | (rolled up in M-031) | annualUsd helper + price math tests |
| M-036 | Plan caps middleware | done (2026-05-04) | `docs/specs/M-036-plan-caps.md` | requirePlanFeature + enforceCap(maxBundles) |
| M-037 | Billing routes | done (2026-05-04) | `docs/specs/M-037-billing-routes.md` | GET, /plans, /subscribe, /cancel; installBillingRoutes DI factory |
| M-038 | Billing UI page (Polaris) | deferred | — | Blocked on admin frontend (M-094+) |

## Phase D — Pricing Engine (M-039 to M-047)

> Locked first because the contract is shared between the Node service and the
> Cart Transform Function. See ADR 0002.

| ID | Title | Status | Spec | Notes |
|----|-------|--------|------|-------|
| M-039 | Pricing engine: spec lock + types + JSON schema | done (2026-05-04) | `docs/specs/M-039-pricing-engine.md` | contract.ts + JSON schema + fixture loader |
| M-040 | Rule type: `fixed` + property tests | done (2026-05-04) | `docs/specs/M-040-fixed-rule.md` | engine.ts + fixed; 3 fixtures; gate/stack/property tests |
| M-041 | Rule type: `percentage` + tests | done (2026-05-05) | `docs/specs/M-041-percentage-rule.md` | floor(subtotal × pct/100); clamp 0–100 |
| M-042 | Rule type: `flat_discount` + tests | done (2026-05-05) | `docs/specs/M-042-flat-discount-rule.md` | per-unit × qty, clamped |
| M-043 | Rule type: `tiered` + tests | done (2026-05-05) | `docs/specs/M-043-tiered-rule.md` | percentage with non-stackable priority cascade |
| M-044 | Rule type: `volume` + tests | done (2026-05-05) | `docs/specs/M-044-volume-rule.md` | per-unit × qualifying-qty above threshold |
| M-045 | Rule type: `bogo` + tests | done (2026-05-05) | `docs/specs/M-045-bogo-rule.md` | sets-based; cheapest units free |
| M-046 | Stackability + priority resolution | done (2026-05-05) | `docs/specs/M-046-stackability.md` | Implemented in M-040; verified by mixed test |
| M-047 | Condition evaluator: tags, geo, dates | done (2026-05-05) | `docs/specs/M-047-conditions.md` | Implemented in M-040; verified by 5 tests |

## Phase E — Bundle Engine (M-048 to M-055)

| ID | Title | Status | Spec | Notes |
|----|-------|--------|------|-------|
| M-048 | Per-type config validators (zod, discriminated union) | done (2026-05-05) | `docs/specs/M-048-bundle-validators.md` | 13-type discriminated union; M-049 consumes |
| M-049 | Bundle service: CRUD | done (2026-05-05) | `docs/specs/M-049-bundle-service.md` | repository layer; un-excluded from tsconfig |
| M-050 | Bundle service: duplicate | done (2026-05-05) | `docs/sessions/0050-bundle-duplicate.md` | Copies items + pricing rules |
| M-051 | Bundle service: publish | done (2026-05-06) | `docs/sessions/0051-bundle-publish.md` + `docs/sessions/0160-competitive-audit-closures.md` | productCreate + components metafield landed 2026-05-06; Cart Transform reads it |
| M-052 | Bundle service: archive + soft delete | done (2026-05-05) | `docs/sessions/0052-bundle-archive.md` | status=archived |
| M-053 | Bundle routes (8 endpoints) | done (2026-05-05) | `docs/specs/M-053-bundle-routes.md` | un-excluded from tsconfig; mounted at /api/v1/bundles |
| M-054 | BundleItem service | done (2026-05-05) | `docs/specs/M-054-bundle-item-service.md` | tenant-safe; reorder uses $transaction |
| M-055 | PricingRule service | done (2026-05-05) | `docs/specs/M-055-pricing-rule-service.md` | tenant-safe add/update/remove |

## Phase F — Vertical Slices (M-056 to M-068)

> One bundle type, end-to-end, per milestone: admin → cart → checkout → order
> processing → SKU breakdown → analytics. Earlier slices set the pattern;
> later ones reuse infra.

| ID | Title | Status | Spec | Notes |
|----|-------|--------|------|-------|
| M-056 | Vertical slice: fixed bundle | done (2026-05-05) | `docs/specs/M-056-fixed-slice.md` | service+pricing slice; cart/checkout layer deferred to M-082+ |
| M-057 | Vertical slice: multipack | done (2026-05-05) | `docs/sessions/0057-multipack-slice.md` | |
| M-058 | Vertical slice: volume bundle | done (2026-05-05) | `docs/sessions/0058-volume-slice.md` | |
| M-059 | Vertical slice: mix-and-match | done (2026-05-05) | `docs/sessions/0059-mix-match-slice.md` | |
| M-060 | Vertical slice: BOGO | done (2026-05-05) | `docs/sessions/0060-bogo-slice.md` | |
| M-061 | Vertical slice: BXGY | done (2026-05-05) | `docs/specs/M-061-068-remaining-slices.md` | bogo rule with mixed-price lines |
| M-062 | Vertical slice: build-a-box | done (2026-05-05) | (same) | steps config + percentage rule |
| M-063 | Vertical slice: subscription bundle | done (2026-05-05) | (same) | Recharge/Bold/Seal at M-119+ |
| M-064 | Vertical slice: gift bundle | done (2026-05-05) | (same) | 100% off |
| M-065 | Vertical slice: mystery bundle | done (2026-05-05) | (same) | fixed discount |
| M-066 | Vertical slice: sample bundle | done (2026-05-05) | (same) | tag-gated 100% off |
| M-067 | Vertical slice: wholesale bundle | done (2026-05-05) | (same) | minWholesaleQuantity + volume rule |
| M-068 | Vertical slice: custom bundle | done (2026-05-05) | (same) | engine returns zero for unknown rule types |

## Phase G — Inventory + Orders (M-069 to M-080)

| ID | Title | Status | Spec | Notes |
|----|-------|--------|------|-------|
| M-069 | Bundle import: CSV format + dry-run | done (2026-05-05) | `docs/specs/M-069-bundle-import.md` | tiny RFC-4180 parser; per-row error capture |
| M-070 | Inventory service: `applyAdjustment` (transactional) | done (2026-05-05) | `docs/specs/M-070-inventory-engine.md` | $transaction; atomic state + audit |
| M-071 | Inventory service: audit log writer | done (2026-05-05) | (same) | `writeAuditLog` in services/inventory/audit.ts |
| M-072 | DB trigger immutability for inventory_audit_log | done (delivered M-009) | `docs/decisions/0003-inventory-transaction-model.md` | BEFORE-UPDATE trigger from M-009 |
| M-073 | Inventory: `recomputeBundleStock` (pure) | done (2026-05-05) | (M-070 spec) | min(component / perBundle) |
| M-074 | Inventory: safety lock workflow | done (2026-05-05) | (M-070 spec) | sync_status='locked', no state mutation |
| M-075 | Inventory routes | done (2026-05-05) | `docs/specs/M-075-inventory-routes.md` | /audit, /sync, /health |
| M-076 | Order processor: extract bundle line items | done (2026-05-05) | `docs/specs/M-076-order-processor.md` | `_bundleforge_bundle_id` property marker |
| M-077 | Order processor: SKU breakdown | done (2026-05-05) | `docs/specs/M-077-sku-breakdown.md` | pure helper |
| M-078 | Webhook handler: `orders/create` | done (2026-05-05) | `docs/specs/M-078-orders-webhooks.md` | persists BundleOrder + applyAdjustment |
| M-079 | Webhook handler: `orders/cancelled` | done (2026-05-05) | (same) | reverses inventory |
| M-080 | Webhook handler: `orders/updated` | done (2026-05-05) | (same) | fulfillmentStatus sync |

## Phase H — Storefront (M-081 to M-093)

| ID | Title | Status | Spec | Notes |
|----|-------|--------|------|-------|
| M-081 | Cart Transform Function: scaffold (JS) | done (2026-05-05) | `docs/specs/M-081-cart-transform-function.md` | extension toml + run.graphql + run.js skeleton |
| M-082 | Cart Transform: read attribute markers | done (2026-05-05) | (same) | `_bundleforge_bundle_id` + `_bundleforge_rules` |
| M-083 | Cart Transform: apply pricing engine | done (2026-05-05) | (same) | port shares contract with Node engine |
| M-084 | Cart Transform: cross-runtime parity test | done (2026-05-05) | (same) | every fixture asserted equal across both engines |
| M-085 | App Proxy: signed bundle config endpoint | done (2026-05-05) | `docs/specs/M-085-app-proxy.md` | timingSafeEqual signature; /api/proxy/bundle/:slug |
| M-086 | Checkout Guardian: cart-level validator | done (2026-05-05) | `docs/specs/M-086-checkout-guardian.md` | validateCart pure + POST /validate-cart |
| M-087 | Checkout Guardian: Validation Function (Plus) | done (2026-05-05) | extensions/checkout-validation/ | min/max via cart attributes |
| M-088 | Theme block: bundle-display | done (2026-05-05) | extensions/theme-extension/ | `<bundleforge-bundle>` web component |
| M-089 | Theme block: variant selector | done (2026-05-05) | (same) | `<bundleforge-variant-picker>` |
| M-090 | Theme block: build-a-box stepper | done (2026-05-05) | (same) | `<bundleforge-build-box>` |
| M-091 | Theme block: mix-match grid | done (2026-05-05) | (same) | `<bundleforge-mix-match>` |
| M-092 | Theme block: BOGO display | done (2026-05-05) | (same) | `<bundleforge-bogo>` |
| M-093 | Theme i18n strings + locales | done (2026-05-05) | (same) | en + es + fr |

## Phase I — Admin Frontend (M-094 to M-108)

| ID | Title | Status | Spec | Notes |
|----|-------|--------|------|-------|
| M-094 | Frontend scaffold: React 18 + Polaris 12 + Vite | done (2026-05-05) | `frontend/vite.config.ts` | jsdom env for tests; Polaris matchMedia polyfill |
| M-095 | App Bridge integration (frontend) | done (2026-05-05) | `frontend/src/AppBridgeProvider.tsx` | v4 meta + CDN script; pass-through provider |
| M-096 | Admin routing | done (2026-05-05) | `frontend/src/App.tsx` | react-router-dom routes |
| M-097 | Bundle list page | done (2026-05-05) | `frontend/src/pages/BundlesListPage.tsx` | IndexTable + fetch /api/v1/bundles |
| M-098 | Bundle detail page | done (2026-05-05) | `frontend/src/pages/BundleDetailPage.tsx` | layout + ProductPicker + TypeConfigPanel |
| M-099 | Visual builder: product picker | done (2026-05-05) | `frontend/src/components/ProductPicker.tsx` | ResourceList over current items |
| M-100 | Visual builder: type config panels | done (2026-05-06) | `frontend/src/components/TypeConfigPanel.tsx` | All 13 type-specific forms; 11 RTL tests |
| M-101 | Visual builder: pricing rules editor | done (2026-05-05) | `docs/specs/M-101-108-admin-pages.md` | Polaris IndexTable, RTL test |
| M-102 | Orders list page + /api/v1/orders | done (2026-05-05) | (same) | paginated list, OrdersListPage |
| M-103 | Order detail + SKU breakdown | done (2026-05-05) | (same) | OrderDetailPage |
| M-104 | Inventory audit page | done (2026-05-05) | (same) | reads /inventory/audit |
| M-105 | Inventory health dashboard | done (2026-05-05) | (same) | reads /inventory/health |
| M-106 | Settings page + PUT /settings | done (2026-05-05) | (same) | safety lock, notifications |
| M-107 | Billing page upgrade | done (2026-05-05) | (same) | subscribe monthly/annual buttons |
| M-108 | Onboarding wizard | done (2026-05-05) | (same) | 3-step wizard component |

## Phase J — Analytics + A/B (M-109 to M-115)

| ID | Title | Status | Spec | Notes |
|----|-------|--------|------|-------|
| M-109 | Analytics ingestion endpoint | done (2026-05-05) | `docs/specs/M-109-115-analytics-ab.md` | POST /events Zod-validated, batched |
| M-110 | Analytics rollup queries | done (2026-05-05) | (same) | groupBy via Prisma; views deferred to M-138+ |
| M-111 | Analytics overview endpoint + dashboard | done (2026-05-05) | (same) | totals + top bundles + AnalyticsOverviewPage |
| M-112 | Per-bundle analytics endpoint | done (2026-05-05) | (same) | groupBy by eventType |
| M-113 | A/B test service: assignment | done (2026-05-05) | (same) | hash-based deterministic; pure |
| M-114 | A/B test routes + UI | done (2026-05-05) | (same) | /significance route + AbTestsPage |
| M-115 | A/B significance calculator | done (2026-05-05) | (same) | two-proportion z-test, normalCdf |

## Phase K — Integrations + AI (M-116 to M-126)

| ID | Title | Status | Spec | Notes |
|----|-------|--------|------|-------|
| M-116 | Integration adapter framework | done (2026-05-05) | `docs/specs/M-116-120-integrations.md` | registry + dispatchOrder; per-adapter error capture |
| M-117 | ShipStation adapter | done (2026-05-05) | (same) | Basic auth + /orders/createorder; 5 tests |
| M-118 | Amazon adapter (basic stub) | done (2026-05-05) | (same) | shape only; SP-API signing in follow-up |
| M-119 | Recharge adapter | done (2026-05-05) | (same) | X-Recharge-Access-Token; /checkouts |
| M-120 | Bold adapter | done (2026-05-05) | (same) | BC-API-Key; /shops/:id/orders |
| M-121 | Klaviyo adapter | done (2026-05-05) | `docs/specs/M-121-126-integrations-ai.md` | metric event; 5 tests |
| M-122 | Google Merchant feed | done (2026-05-05) | (same) | Atom XML + public route + 4 tests |
| M-123 | Shopify Flow connector | done (2026-05-05) | (same) | 1 action + 2 triggers manifest |
| M-124 | AI microservice scaffold (Python/Flask) | done (2026-05-05) | (same) | /health + /recommendations + bearer auth |
| M-125 | AI FBT recommender | done (2026-05-05) | (same) | co-occurrence + lift; 6 pytest cases |
| M-126 | Node AI integration + /ai/recommendations | done (2026-05-05) | (same) | client + route + 4 supertest cases |

## Phase L — Migration Tools (M-127 to M-130)

| ID | Title | Status | Spec | Notes |
|----|-------|--------|------|-------|
| M-127 | Migration: Shopify Bundles importer | done (2026-05-05) | `docs/specs/M-127-130-migrations.md` | pure converter; 3 tests |
| M-128 | Migration: Simple Bundles importer | done (2026-05-05) | (same) | bundle/rule type maps; 3 tests |
| M-129 | Migration: Bundler.app importer | done (2026-05-05) | (same) | CSV with pipe items; 4 tests |
| M-130 | Migration: Kaching importer | done (2026-05-05) | (same) | volume tier ladder; 4 tests |

## Phase M — i18n (M-131 to M-136)

| ID | Title | Status | Spec | Notes |
|----|-------|--------|------|-------|
| M-131 | i18n framework | done (2026-05-06) | `docs/specs/M-131-136-i18n.md` | tiny in-house t() with fallback; 7 tests; 15 locales (added ja/zh/ko/nl/pl/sv/da/no/ru on 2026-05-06) |
| M-132 | English baseline strings | done (2026-05-05) | (same) | en.json |
| M-133 | Spanish translation | done (2026-05-05) | (same) | es.json |
| M-134 | French translation | done (2026-05-05) | (same) | fr.json |
| M-135 | German translation | done (2026-05-05) | (same) | de.json |
| M-136 | Italian + Portuguese | done (2026-05-05) | (same) | it.json + pt.json |

## Phase N — Hardening (M-137 to M-150)

| ID | Title | Status | Spec | Notes |
|----|-------|--------|------|-------|
| M-137 | Inventory engine concurrency property test | done (2026-05-05) | `docs/specs/M-137-139-property-tests.md` | mutex'd fake repo; 100 concurrent decrements |
| M-138 | Webhook throughput synthetic | done (2026-05-05) | (same) | 100 webhooks acked under 5s |
| M-139 | Pricing engine property tests (extended) | done (2026-05-05) | (same) | 4 invariants × 200 random inputs |
| M-140 | Security review pass | done (2026-05-05) | `docs/decisions/0004-security-review.md` | OWASP top 10 + npm audit triage |
| M-141 | Accessibility audit (WCAG AA) | done (2026-05-05) | `docs/specs/M-141-149-hardening.md` | jsx-a11y plugin + axe-core smoke tests |
| M-142 | Sentry coverage audit | done (2026-05-05) | (same) | Workers now captureException on `failed`; audit appended to `docs/runbook.md` |
| M-143 | Datadog dashboards: queue, webhooks, sync | done (2026-05-05) | (same) | 4 dashboards under `monitoring/datadog/dashboards/` + README |
| M-144 | Runbook: incident response | done (2026-05-05) | (same) | `docs/runbook-incidents.md` |
| M-145 | Backup + restore drill | done (2026-05-05) | (same) | `scripts/backup.sh` + `scripts/restore.sh`; drill in runbook |
| M-146 | GDPR data export endpoint | done (2026-05-05) | (same) | `POST /api/v1/gdpr/export`; creds redacted |
| M-147 | GDPR data deletion endpoint | done (2026-05-05) | (same) | `POST /api/v1/gdpr/delete-shop`; cascade |
| M-148 | Rate limit hardening + abuse tests | done (2026-05-05) | (same) | per-IP secondary limiter on auth/webhooks/health |
| M-149 | OpenAPI documentation generated | done (2026-05-05) | (same) | `docs/openapi.yaml` + `npm run docs:openapi` |
| M-150 | Privacy policy + ToS templates committed | done (2026-05-05) | `docs/specs/M-150-155-launch.md` | `legal/privacy-policy.md` + `legal/terms-of-service.md` (templates) |

## Phase R — Rich Admin UI (M-161+, post-launch)

> Roadmap: `docs/plans/rich-admin-ui-roadmap.md`. 22 milestones in
> 4 independent phases (Settings depth / Bundle Detail richness /
> Bundle List richness / Cross-cutting polish). Status updated as
> each lands.

### Phase R1 — Settings depth

| ID | Title | Status | Spec | Notes |
|----|-------|--------|------|-------|
| M-161 | Settings shell + General tab | done (2026-05-06) | `docs/specs/M-161-settings-shell-general.md` | 10-tab shell with hash routing; General tab with Shop/Brand/Defaults cards; deep-merged settings.general subobject |
| M-162 | Display tab | done (2026-05-06) | `docs/specs/M-162-settings-display-tab.md` | 3 cards: Layout/visual style, Imagery & copy, Custom CSS. Server: settings.display deep-merge. Theme-block consumption deferred to M-162b. |
| M-163 | Inventory + Pricing tabs | done (2026-05-06) | `docs/specs/M-163-settings-inventory-pricing.md` | 4 cards across 2 tabs. Inventory: stock guards (safetyLock + threshold + oversell + alert) + audit retention/snapshots. Pricing: rounding/formatting + defaults for new bundles (discount type + B2B markup). |
| M-164 | Cart & Checkout tab | done (2026-05-06) | `docs/specs/M-164-settings-cart-checkout.md` | 2 cards: Cart mode (bundle_as_product / components_as_attributes), Checkout protections (atomic enforcement, abandonment, line-note template). Cart Transform Function reads optional shop metafield + branches; M-164b will write the metafield from the admin save action. |
| M-165 | Notifications & alerts tab | done (2026-05-06) | `docs/specs/M-165-settings-notifications.md` | 3 cards: Channels (recipients, Slack/Teams URLs, in-app), Email channel (master toggle), Alert rules (5 rules × 4 channels each). Schema upgrade preserves backwards compat with the existing email/inApp toggles. |
| M-166 | Integrations tab | done (2026-05-06) | `docs/specs/M-166-settings-integrations.md` | New `/api/v1/integrations` route with GET/PUT/POST-test/DELETE; AES-256 encrypted credentials; one Card + Configure modal per known adapter (ShipStation, Recharge, Bold, Klaviyo, Amazon, Google Merchant). |
| M-167 | Localization + Billing tabs + GM feed URL | done (2026-05-06) | `docs/specs/M-167-settings-api-localization-billing.md` | Re-scoped mid-spec — API & webhooks split into M-168. Localization tab (3 controls), Billing tab (extracted shared BillingPanel), Google Merchant feed URL surfaced on Integrations tab. |
| M-168 | API tokens + outbound webhooks tab | done (2026-05-06) | `docs/specs/M-168-settings-api-webhooks.md` | Two new Prisma models + migration, two new CRUD routes (/api/v1/api-tokens, /api/v1/outbound-webhooks), scrypt-based token hashing, frontend ApiWebhooksTab with Tokens + Webhooks cards. Plaintext token + HMAC secret returned exactly once. **Phase R1 closed: 8/8 milestones done.** |

### Phase R2 — Bundle Detail richness

> Renumbered 2026-05-06: the original roadmap started Phase R2 at
> M-168, but M-167's mid-spec split into M-168 (API & webhooks)
> shifted every Phase R2-R4 slot by 1.

| ID | Title | Status |
|----|-------|--------|
| M-169 | Detail shell tab refactor | done (2026-05-06) — `docs/specs/M-169-bundle-detail-tab-shell.md` |
| M-170 | Schedule tab | done (2026-05-06) — `docs/specs/M-170-bundle-detail-schedule.md` |
| M-171 | Display tab | done (2026-05-06) — `docs/specs/M-171-bundle-detail-display.md` |
| M-172 | Customers tab | done (2026-05-06) — `docs/specs/M-172-bundle-detail-customers.md` |
| M-173 | Inventory tab | done (2026-05-06) — `docs/specs/M-173-bundle-detail-inventory.md` |
| M-174 | Performance + Activity log | done (2026-05-06) — `docs/specs/M-174-bundle-detail-performance-activity.md` |
| M-175 | Advanced tab | done (2026-05-06) — `docs/specs/M-175-bundle-detail-advanced.md` |

### Phase R3 — Bundle List richness

| ID | Title | Status |
|----|-------|--------|
| M-176 | IndexFilters + saved views | done (2026-05-06) — `docs/specs/M-176-bundle-list-indexfilters.md` |
| M-177 | Bulk actions | done (2026-05-06) — `docs/specs/M-177-bundle-list-bulk-actions.md` |
| M-178 | Sort + view modes | done (2026-05-06) — `docs/specs/M-178-bundle-list-sort-view-modes.md` |
| M-179 | Templates / Presets gallery | done (2026-05-06) — `docs/specs/M-179-bundle-list-templates.md` |

### Phase R4 — Cross-cutting polish

| ID | Title | Status |
|----|-------|--------|
| M-180 | Global cmd+k search | done (2026-05-06) — `docs/specs/M-180-global-cmdk-search.md` |
| M-181 | In-app help drawer | done (2026-05-06) — `docs/specs/M-181-help-drawer.md` |
| M-182 | Unified toast / confirm / skeleton | done (2026-05-06) — `docs/specs/M-182-unified-toast-confirm-skeleton.md` |
| M-183 | Empty-state illustrations | done (2026-05-06) — `docs/specs/M-183-empty-state-illustrations.md` |

### Phase R5 — App home + navigation polish

| ID | Title | Status |
|----|-------|--------|
| M-184 | Dashboard widgets on app home | done (2026-05-07) — `docs/specs/M-184-dashboard-widgets.md` |
| M-185 | Settings two-pane left sidebar | done (2026-05-07) — `docs/specs/M-185-settings-left-sidebar.md` |
| M-186 | Dashboard onboarding checklist + language select | done (2026-05-07) — `docs/specs/M-186-onboarding-checklist.md` |
| M-187 | Support page (`/support`) | done (2026-05-07) — `docs/specs/M-187-support-page.md` |
| M-188 | Frontend admin i18n (real translations) | done (2026-05-07) — `docs/specs/M-188-frontend-i18n.md` |

### Post-R follow-ups

| ID | Title | Status |
|----|-------|--------|
| M-200 | Enforce Starter `maxOrdersPerMonth` | done (2026-05-07) — `docs/specs/M-200-starter-order-cap.md` |
| M-201 | 80%-of-cap admin banner on Dashboard | done (2026-05-07) — `docs/specs/M-201-cap-warning-banner.md` |

---

## Phase O — Beta + Launch (M-151 to M-155)

| ID | Title | Status | Spec | Notes |
|----|-------|--------|------|-------|
| M-151 | Demo store seed data + demo bundle showcase | done (2026-05-05) | `docs/specs/M-150-155-launch.md` | `prisma/seed.ts` extended; `scripts/demo-reset.sh` |
| M-152 | Beta merchant onboarding flow | done (2026-05-05) | (same) | `docs/onboarding-beta.md` |
| M-153 | App Store screenshots + video script | done (2026-05-05) | (same) | `docs/launch/screenshots-spec.md` + `video-script.md` |
| M-154 | App Store submission package | done (2026-05-05) | (same) | `docs/launch/app-listing.md` + `submission-checklist.md` |
| M-155 | Public launch checklist | done (2026-05-05) | (same) | `docs/launch/launch-checklist.md` |

---

## Completed milestones

| ID | Title | Completed | Session log |
|----|-------|-----------|-------------|
| M-000 | Bootstrap planning system | 2026-05-04 | `docs/sessions/0000-bootstrap-planning-system.md` |
| M-001 | Env validation + secrets bootstrap | 2026-05-04 | `docs/sessions/0001-env-bootstrap.md` |
| M-002 | Encryption utility (AES-256-GCM) | 2026-05-04 | `docs/sessions/0002-encryption.md` |
| M-003 | Logger (pino) | 2026-05-04 | `docs/sessions/0003-logger.md` |
| M-004 | Prisma client | 2026-05-04 | `docs/sessions/0004-prisma-client.md` |
| M-005 | Redis + BullMQ | 2026-05-04 | `docs/sessions/0005-redis-bullmq.md` |
| M-006 | Server scaffold + /health | 2026-05-04 | `docs/sessions/0006-server-scaffold.md` |
| M-007 | Error handler middleware | 2026-05-04 | `docs/sessions/0007-error-handler.md` |
| M-008 | Rate limiter | 2026-05-04 | `docs/sessions/0008-rate-limiter.md` |
| M-009 | Initial Prisma migration | 2026-05-04 | `docs/sessions/0009-initial-migration.md` |
| M-010 | Seed script | 2026-05-04 | `docs/sessions/0010-seed.md` |
| M-011 | CI typecheck | 2026-05-04 | `docs/sessions/0011-ci-typecheck.md` |
| M-012 | ESLint flat config + CI lint | 2026-05-04 | `docs/sessions/0012-eslint.md` |
| M-013 | CI test job verified | 2026-05-04 | `docs/sessions/0013-ci-test.md` |
| M-014 | docker-compose for local dev | 2026-05-04 | `docs/sessions/0014-docker-compose.md` |
| M-015 | Sentry integration | 2026-05-04 | `docs/sessions/0015-sentry.md` |
| M-016 | Shopify app config validation | 2026-05-04 | `docs/sessions/0016-shopify-app-config.md` |
| M-017 | OAuth install route | 2026-05-04 | `docs/sessions/0017-oauth-install.md` |
| M-018 | OAuth callback + persist | 2026-05-04 | `docs/sessions/0018-oauth-callback.md` |
| M-019 | Session middleware | 2026-05-04 | `docs/sessions/0019-session-middleware.md` |
| M-020 | Prisma session storage | 2026-05-04 | `docs/sessions/0020-prisma-session.md` |
| M-021 | App Bridge session validation | 2026-05-04 | `docs/sessions/0021-app-bridge.md` |
| M-022 | GraphQL client wrapper | 2026-05-04 | `docs/sessions/0022-graphql-client.md` |
| M-023 | REST client wrapper | 2026-05-04 | `docs/sessions/0023-rest-client.md` |
| M-024 | Webhook HMAC verifier | 2026-05-04 | `docs/sessions/0024-webhook-hmac.md` |
| M-025 | Webhook dispatcher | 2026-05-04 | `docs/sessions/0025-webhook-dispatcher.md` |
| M-026 | app/uninstalled + registry | 2026-05-04 | `docs/sessions/0026-app-uninstalled.md` |
| M-027 | shop/update | 2026-05-04 | `docs/sessions/0027-shop-update.md` |
| M-028 | customers/data_request | 2026-05-04 | `docs/sessions/0028-customers-data-request.md` |
| M-029 | customers/redact | 2026-05-04 | `docs/sessions/0029-customers-redact.md` |
| M-030 | shop/redact | 2026-05-04 | `docs/sessions/0030-shop-redact.md` |
| M-031 | Plan registry (full) | 2026-05-04 | `docs/sessions/0031-plan-registry.md` |
| M-032 | appSubscriptionCreate | 2026-05-04 | `docs/sessions/0032-app-subscription-create.md` |
| M-033 | subscription sync webhook | 2026-05-04 | `docs/sessions/0033-subscription-sync.md` |
| M-034 | cancel + plan change | 2026-05-04 | `docs/sessions/0034-cancel-and-change.md` |
| M-035 | Annual billing 20% (rolled up M-031) | 2026-05-04 | `docs/sessions/0031-plan-registry.md` |
| M-036 | Plan caps middleware | 2026-05-04 | `docs/sessions/0036-plan-caps.md` |
| M-037 | Billing routes | 2026-05-04 | `docs/sessions/0037-billing-routes.md` |
| M-038 | (Deferred) Billing UI | — | — |
| M-039 | Pricing engine spec lock | 2026-05-04 | `docs/sessions/0039-pricing-engine.md` |
| M-040 | Fixed rule + property tests | 2026-05-04 | `docs/sessions/0040-fixed-rule.md` |
| M-041 | percentage rule | 2026-05-05 | `docs/sessions/0041-percentage-rule.md` |
| M-042 | flat_discount rule | 2026-05-05 | `docs/sessions/0042-flat-discount-rule.md` |
| M-043 | tiered rule | 2026-05-05 | `docs/sessions/0043-tiered-rule.md` |
| M-044 | volume rule | 2026-05-05 | `docs/sessions/0044-volume-rule.md` |
| M-045 | bogo rule | 2026-05-05 | `docs/sessions/0045-bogo-rule.md` |
| M-046 | stackability + priority verified | 2026-05-05 | `docs/sessions/0046-stackability.md` |
| M-047 | condition evaluator verified | 2026-05-05 | `docs/sessions/0047-conditions.md` |
| M-048 | bundle config validators | 2026-05-05 | `docs/sessions/0048-bundle-validators.md` |
| M-049 | bundle service CRUD rewrite | 2026-05-05 | `docs/sessions/0049-bundle-service.md` |
| M-050 | bundle duplicate | 2026-05-05 | `docs/sessions/0050-bundle-duplicate.md` |
| M-051 | bundle publish | 2026-05-05 | `docs/sessions/0051-bundle-publish.md` |
| M-052 | bundle archive | 2026-05-05 | `docs/sessions/0052-bundle-archive.md` |
| M-053 | bundle routes | 2026-05-05 | `docs/sessions/0053-bundle-routes.md` |
| M-054 | BundleItem service | 2026-05-05 | `docs/sessions/0054-bundle-item-service.md` |
| M-055 | PricingRule service | 2026-05-05 | `docs/sessions/0055-pricing-rule-service.md` |
| M-056 | Fixed bundle slice | 2026-05-05 | `docs/sessions/0056-fixed-slice.md` |
| M-057 | Multipack slice | 2026-05-05 | `docs/sessions/0057-multipack-slice.md` |
| M-058 | Volume slice | 2026-05-05 | `docs/sessions/0058-volume-slice.md` |
| M-059 | Mix-and-match slice | 2026-05-05 | `docs/sessions/0059-mix-match-slice.md` |
| M-060 | BOGO slice | 2026-05-05 | `docs/sessions/0060-bogo-slice.md` |
| M-061..M-068 | Remaining vertical slices | 2026-05-05 | `docs/sessions/0061-068-remaining-slices.md` |
| M-069 | Bundle CSV import | 2026-05-05 | `docs/sessions/0069-bundle-import.md` |
| M-070..M-074 | Inventory engine + safety lock | 2026-05-05 | `docs/sessions/0070-inventory-engine.md` |
| M-075 | Inventory routes | 2026-05-05 | `docs/sessions/0075-inventory-routes.md` |
| M-076..M-077 | Order processor + SKU breakdown | 2026-05-05 | `docs/sessions/0076-order-processor.md` |
| M-078..M-080 | Order webhook handlers | 2026-05-05 | `docs/sessions/0078-order-webhooks.md` |
| M-081..M-084 | Cart Transform Function (cross-runtime parity) | 2026-05-05 | `docs/sessions/0081-cart-transform-function.md` |
| M-085..M-086 | App Proxy + Checkout Guardian | 2026-05-05 | `docs/sessions/0085-app-proxy-and-guardian.md` |
| M-087 | Validation Function (Plus only) | 2026-05-05 | `docs/sessions/0087-validation-function.md` |
| M-088..M-093 | Theme extension blocks + i18n | 2026-05-05 | `docs/sessions/0088-theme-extension.md` |
| M-094..M-100 | Admin frontend scaffold + first pages | 2026-05-05 | `docs/sessions/0094-frontend-scaffold.md` |
| M-101..M-108 | Admin pages: rules editor, orders, inventory, settings, billing, onboarding | 2026-05-05 | `docs/sessions/0101-admin-pages.md` |
| M-109..M-115 | Analytics ingestion + dashboard + A/B significance | 2026-05-05 | `docs/sessions/0109-analytics-ab.md` |
| M-116..M-120 | Integration adapter framework + 4 adapters | 2026-05-05 | `docs/sessions/0116-integrations.md` |
| M-121..M-126 | Klaviyo + Google Merchant + Flow + AI service | 2026-05-05 | `docs/sessions/0121-integrations-ai.md` |
| M-127..M-130 | 4 competitor migration importers | 2026-05-05 | `docs/sessions/0127-migrations.md` |
| M-131..M-136 | Server-side i18n + 6 locales | 2026-05-05 | `docs/sessions/0131-i18n.md` |
| M-137..M-139 | Concurrency + throughput + pricing invariants | 2026-05-05 | `docs/sessions/0137-property-tests.md` |
| M-140 | Security review pass + ADR-0004 | 2026-05-05 | `docs/sessions/0140-security-review.md` |
| M-141..M-149 | Hardening (a11y, observability, GDPR, rate limit, OpenAPI) | 2026-05-05 | `docs/sessions/0141-hardening.md` |
| M-150..M-155 | Launch (legal templates, demo data, beta onboarding, App Store) | 2026-05-05 | `docs/sessions/0150-launch.md` |
| post-M-155 | First real Shopify install: deploy + auth + iframe + create-bundle fixes; new SPA-headers, auth-flow, Playwright test layers; CI e2e job | 2026-05-05 | `docs/sessions/0157-first-install-deploy-fixes.md` |
| post-M-155 | Crisp live chat + Storefront API for Hydrogen + Bundle CRUD e2e + Railway runbook + audit-driven UI polish | 2026-05-06 | `docs/sessions/0158-crisp-storefront-crud-e2e.md` |
| post-M-155 | Visual UI revamp: card-grid bundle type picker + differentiator-led fresh-shop dashboard + App Bridge sidebar `<a>` fix | 2026-05-06 | `docs/sessions/0159-ui-revamp-navmenu-typecards.md` |

---

## Notes on this roster

- Total: **156 milestones** (M-000 through M-155).
- This is a planning estimate. Milestones may be split or merged as they're
  worked. Any change is logged in the session that makes it.
- Spec files are written **just-in-time**, at the start of the session that
  implements the milestone, not all up front. That keeps specs honest with
  current understanding.
- ADRs in `docs/decisions/` capture cross-cutting decisions that span many
  milestones (architecture, contracts, conventions).
