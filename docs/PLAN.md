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
| M-051 | Bundle service: publish | done (2026-05-05) | `docs/sessions/0051-bundle-publish.md` | status=active; Shopify product sync deferred to slices |
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
| M-100 | Visual builder: type config panels | done (2026-05-05) | `frontend/src/components/TypeConfigPanel.tsx` | 5 type-specific forms; 3 RTL tests |
| M-101 | Visual builder: pricing rules editor | pending | — | |
| M-102 | Orders list page | pending | — | |
| M-103 | Order detail with SKU breakdown | pending | — | |
| M-104 | Inventory audit page | pending | — | |
| M-105 | Inventory health dashboard | pending | — | |
| M-106 | Settings page | pending | — | |
| M-107 | Billing/Plans page | pending | — | |
| M-108 | Onboarding wizard | pending | — | |

## Phase J — Analytics + A/B (M-109 to M-115)

| ID | Title | Status | Spec | Notes |
|----|-------|--------|------|-------|
| M-109 | Analytics ingestion endpoint | pending | — | From storefront events |
| M-110 | Analytics rollup tables / materialized views | pending | — | |
| M-111 | Analytics overview endpoint + dashboard | pending | — | |
| M-112 | Per-bundle analytics endpoint | pending | — | |
| M-113 | A/B test service: assignment + tracking | pending | — | |
| M-114 | A/B test routes + UI | pending | — | |
| M-115 | A/B test significance calculator | pending | — | |

## Phase K — Integrations + AI (M-116 to M-126)

| ID | Title | Status | Spec | Notes |
|----|-------|--------|------|-------|
| M-116 | Integration adapter framework | pending | — | Abstract interface |
| M-117 | ShipStation adapter | pending | — | |
| M-118 | Amazon adapter (basic) | pending | — | |
| M-119 | Recharge adapter | pending | — | Subscription bundles |
| M-120 | Bold adapter | pending | — | |
| M-121 | Klaviyo adapter | pending | — | |
| M-122 | Google Merchant feed | pending | — | |
| M-123 | Shopify Flow triggers + actions | pending | — | |
| M-124 | AI microservice: scaffold (Python/Flask) | pending | — | |
| M-125 | AI: FBT recommender (sklearn) | pending | — | |
| M-126 | AI: `/ai/recommendations` integration + retraining job | pending | — | |

## Phase L — Migration Tools (M-127 to M-130)

| ID | Title | Status | Spec | Notes |
|----|-------|--------|------|-------|
| M-127 | Migration: Shopify Bundles importer | pending | — | |
| M-128 | Migration: Simple Bundles importer | pending | — | |
| M-129 | Migration: Bundler importer | pending | — | |
| M-130 | Migration: Kaching importer | pending | — | |

## Phase M — i18n (M-131 to M-136)

| ID | Title | Status | Spec | Notes |
|----|-------|--------|------|-------|
| M-131 | i18n framework (i18next) | pending | — | Admin + storefront |
| M-132 | English baseline strings | pending | — | |
| M-133 | Spanish translation | pending | — | Pro translation budget |
| M-134 | French translation | pending | — | |
| M-135 | German translation | pending | — | |
| M-136 | Italian + Portuguese translation | pending | — | |

## Phase N — Hardening (M-137 to M-150)

| ID | Title | Status | Spec | Notes |
|----|-------|--------|------|-------|
| M-137 | Load test: inventory engine concurrency | pending | — | |
| M-138 | Load test: webhook throughput | pending | — | |
| M-139 | Property tests: pricing engine (extended) | pending | — | |
| M-140 | Security review pass | pending | — | OWASP top 10 |
| M-141 | Accessibility audit (WCAG AA) | pending | — | |
| M-142 | Sentry coverage audit | pending | — | Every error path |
| M-143 | Datadog dashboards: queue, webhooks, sync | pending | — | |
| M-144 | Runbook: incident response | pending | — | |
| M-145 | Backup + restore drill | pending | — | |
| M-146 | GDPR data export endpoint | pending | — | |
| M-147 | GDPR data deletion endpoint | pending | — | |
| M-148 | Rate limit hardening + abuse tests | pending | — | |
| M-149 | OpenAPI documentation generated | pending | — | |
| M-150 | Privacy policy + ToS templates committed | pending | — | Legal review by user |

## Phase O — Beta + Launch (M-151 to M-155)

| ID | Title | Status | Spec | Notes |
|----|-------|--------|------|-------|
| M-151 | Demo store seed data + demo bundle showcase | pending | — | |
| M-152 | Beta merchant onboarding flow | pending | — | |
| M-153 | App Store screenshots + video script | pending | — | User produces video |
| M-154 | App Store submission package | pending | — | |
| M-155 | Public launch checklist | pending | — | |

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
