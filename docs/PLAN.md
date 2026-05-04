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
| M-041 | Rule type: `percentage` + tests | pending | — | |
| M-042 | Rule type: `flat_discount` + tests | pending | — | |
| M-043 | Rule type: `tiered` + tests | pending | — | |
| M-044 | Rule type: `volume` + tests | pending | — | |
| M-045 | Rule type: `bogo` + tests | pending | — | |
| M-046 | Stackability + priority resolution | pending | — | |
| M-047 | Condition evaluator: tags, geo, dates | pending | — | |

## Phase E — Bundle Engine (M-048 to M-055)

| ID | Title | Status | Spec | Notes |
|----|-------|--------|------|-------|
| M-048 | Per-type config validators (zod, discriminated union) | pending | — | One validator per bundle type |
| M-049 | Bundle service: CRUD | pending | — | Replace stub |
| M-050 | Bundle service: duplicate | pending | — | |
| M-051 | Bundle service: publish (Shopify product + metafields) | pending | — | Writes contract for Cart Transform |
| M-052 | Bundle service: archive + soft delete | pending | — | |
| M-053 | Bundle routes (9 endpoints) | pending | — | Per ARCHITECTURE §5.1 |
| M-054 | BundleItem service | pending | — | |
| M-055 | PricingRule service | pending | — | Persists rules from §D |

## Phase F — Vertical Slices (M-056 to M-068)

> One bundle type, end-to-end, per milestone: admin → cart → checkout → order
> processing → SKU breakdown → analytics. Earlier slices set the pattern;
> later ones reuse infra.

| ID | Title | Status | Spec | Notes |
|----|-------|--------|------|-------|
| M-056 | Vertical slice: fixed bundle E2E | pending | — | Sets the pattern for all slices |
| M-057 | Vertical slice: multipack E2E | pending | — | |
| M-058 | Vertical slice: volume bundle E2E | pending | — | |
| M-059 | Vertical slice: mix-and-match E2E | pending | — | |
| M-060 | Vertical slice: BOGO E2E | pending | — | |
| M-061 | Vertical slice: BXGY E2E | pending | — | |
| M-062 | Vertical slice: build-a-box E2E | pending | — | |
| M-063 | Vertical slice: subscription bundle E2E | pending | — | Recharge integration may defer |
| M-064 | Vertical slice: gift bundle E2E | pending | — | |
| M-065 | Vertical slice: mystery bundle E2E | pending | — | |
| M-066 | Vertical slice: sample bundle E2E | pending | — | |
| M-067 | Vertical slice: wholesale bundle E2E | pending | — | |
| M-068 | Vertical slice: custom bundle E2E | pending | — | |

## Phase G — Inventory + Orders (M-069 to M-080)

| ID | Title | Status | Spec | Notes |
|----|-------|--------|------|-------|
| M-069 | Bundle import: CSV format + dry-run | pending | — | |
| M-070 | Inventory service: `applyAdjustment` (transactional) | pending | — | `SELECT … FOR UPDATE` |
| M-071 | Inventory service: audit log writer | pending | — | Insert-only |
| M-072 | DB grants: `REVOKE UPDATE, DELETE` on `inventory_audit_log` | pending | — | See ADR 0003 |
| M-073 | Inventory service: `recomputeBundleStock` | pending | — | |
| M-074 | Inventory service: safety lock workflow | pending | — | Per `Shop.settings` |
| M-075 | Inventory routes (audit, sync, health) | pending | — | |
| M-076 | Order processor: parse + extract bundle line items | pending | — | |
| M-077 | Order processor: SKU breakdown | pending | — | |
| M-078 | Webhook handler: `orders/create` | pending | — | Dispatches to BullMQ |
| M-079 | Webhook handler: `orders/cancelled` | pending | — | Reverses inventory |
| M-080 | Webhook handler: `orders/updated` | pending | — | Refunds, partial fulfillment |

## Phase H — Storefront (M-081 to M-093)

| ID | Title | Status | Spec | Notes |
|----|-------|--------|------|-------|
| M-081 | Cart Transform Function: scaffold (JS) | pending | — | |
| M-082 | Cart Transform: read bundle metafields | pending | — | |
| M-083 | Cart Transform: apply pricing engine | pending | — | Reuses contract from M-039 |
| M-084 | Cart Transform: tests with Function test runner | pending | — | |
| M-085 | App Proxy: signed bundle config endpoint | pending | — | |
| M-086 | Checkout Guardian: cart-level validator | pending | — | App Proxy route |
| M-087 | Checkout Guardian: Validation Function (Plus only) | pending | — | Honest gating in UI |
| M-088 | Theme extension: bundle-display block (full) | pending | — | Replaces stub `bundle-display.liquid` |
| M-089 | Theme extension: variant selector | pending | — | |
| M-090 | Theme extension: build-a-box stepper | pending | — | |
| M-091 | Theme extension: mix-match grid | pending | — | |
| M-092 | Theme extension: BOGO display | pending | — | |
| M-093 | Theme extension: i18n strings + locale loader | pending | — | |

## Phase I — Admin Frontend (M-094 to M-108)

| ID | Title | Status | Spec | Notes |
|----|-------|--------|------|-------|
| M-094 | Frontend scaffold: React 18 + Polaris 12 + Vite | pending | — | Or commit to Remix template here |
| M-095 | App Bridge integration (frontend) | pending | — | |
| M-096 | Admin routing | pending | — | |
| M-097 | Bundle list page | pending | — | Filter, sort, pagination |
| M-098 | Bundle detail page | pending | — | |
| M-099 | Visual builder: product picker | pending | — | |
| M-100 | Visual builder: type-specific config panels | pending | — | |
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
