# BundleForge

**The most reliable Shopify product bundling app.**

BundleForge is a production-ready Shopify product bundling app: 13 bundle
types, cents-exact pricing parity between the storefront, cart, and
checkout, atomic SKU-accurate inventory, and a complete admin with
analytics, A/B testing, and integrations.

> **Status:** all 156 milestones complete (M-000..M-155). 442 automated
> tests passing. Ready for App Store submission. See `docs/STATE.md`
> and `docs/PLAN.md`.

## What's in the box

- **13 bundle types** — fixed, mix-and-match, BOGO, BxGy, volume,
  build-a-box, multipack, gift, mystery, sample, subscription,
  wholesale, custom.
- **Pricing parity** — the same engine runs server-side
  (`src/services/pricing/engine.ts`) and in the Cart Transform
  Function (`extensions/cart-transform/src/pricing.js`); a shared
  fixture suite asserts cents-exact agreement on every commit.
- **Inventory engine** — `applyAdjustment` runs in
  `prisma.$transaction`, atomically updates `inventory_sync_state` +
  the append-only `inventory_audit_log` (UPDATE protected at the DB
  level).
- **Storefront block** — Theme App Extension drops onto any Online
  Store 2.0 theme. No code edits.
- **Admin** — React 18 + Polaris 12: bundles, orders, inventory
  (audit + health), analytics overview, A/B tests, settings,
  billing, onboarding wizard.
- **Integrations** — ShipStation, Amazon, ReCharge, Bold
  Subscriptions, Klaviyo, Google Merchant feeds, Shopify Flow.
- **Migrations** — importers for Shopify Bundles, Simple Bundles,
  Bundler, Kaching.
- **AI** — Python recommender microservice with bearer-auth Node
  client and graceful degradation.
- **i18n** — server-side `t()` with English fallback; en, es, fr, de,
  it, pt locale files. Theme extension ships en/es/fr.
- **Observability** — Pino structured logs, Sentry error capture
  (HTTP + workers), 4 Datadog dashboard JSONs under
  `monitoring/datadog/`, `/health` liveness probe.
- **Security** — AES-256-GCM at rest, HMAC verification on every
  webhook + App Proxy call, append-only audit log, Zod input
  validation, sort-column allowlist, per-shop + per-IP rate limiting.
  See ADR-0004.
- **GDPR** — `POST /api/v1/gdpr/export` (creds redacted) and
  `POST /api/v1/gdpr/delete-shop` (cascade), plus the three mandatory
  Shopify GDPR webhooks.

## Tech stack

| Layer | Technology |
|---|---|
| Runtime | Node.js 20 + TypeScript 5 (strict) |
| Backend | Express 4 + `@shopify/shopify-app-express` |
| Frontend | React 18 + Shopify Polaris 12 + Vite |
| Database | PostgreSQL 16 (Prisma 5) |
| Cache/Queue | Redis 7 + BullMQ |
| Functions | Shopify Functions — Cart Transform (JS) + Validation (Plus) |
| Theme | Theme App Extensions (Liquid + Web Components) |
| AI | Python microservice (Flask + scikit-learn) |
| Tests | Vitest (unit + integration + property), Playwright (E2E) |
| Observability | Pino, Sentry, Datadog |
| CI/CD | GitHub Actions |

## Project structure

```
bundleforge/
├── prisma/
│   ├── schema.prisma          # 12 models, 5 domains
│   ├── migrations/
│   └── seed.ts                # demo store: 8 bundles, orders, audit
├── src/
│   ├── server/                # Express factory + /health
│   ├── config/                # env (Zod), logger (Pino), db, redis, sentry
│   ├── routes/                # bundles, orders, inventory, analytics,
│   │                          # settings, billing, ai, gdpr, proxy, feeds
│   ├── services/
│   │   ├── pricing/           # engine + cross-runtime contract
│   │   ├── bundles/           # CRUD, validators, CSV, migrations
│   │   ├── inventory/         # atomic adjustments + audit
│   │   ├── orders/            # extract, SKU breakdown, repository
│   │   ├── billing/           # plan caps, subscribe, change, cancel
│   │   ├── analytics/         # ingestion, A/B significance
│   │   ├── integrations/      # registry + 7 adapters
│   │   └── ai/                # bearer-auth client
│   ├── middleware/            # errorHandler, rateLimiter (+ ipRateLimiter),
│   │                          # shopSession, planCaps, shopifyWebhook,
│   │                          # appProxy
│   ├── webhooks/              # HMAC verifier + 9 handlers
│   ├── jobs/                  # BullMQ workers
│   ├── i18n/                  # tiny t() + 6 locale JSONs
│   └── shopify/               # SDK init + install hook
├── extensions/
│   ├── cart-transform/        # Shopify Function — pricing parity
│   ├── checkout-validation/   # Plus-only validation function
│   ├── theme-extension/       # 5 App Blocks + bundleforge-bundle.js
│   └── flow/                  # 3 Shopify Flow triggers
├── ai-service/                # Python recommender + tests + Dockerfile
├── frontend/                  # Vite + React 18 + Polaris admin
│   └── src/
│       ├── pages/             # 10 admin pages
│       ├── components/        # PricingRulesEditor, OnboardingWizard, …
│       └── __a11y__/          # axe-core smoke tests
├── tests/
│   ├── property/              # concurrency, throughput, pricing invariants
│   └── pricing/fixtures/      # cross-runtime parity JSON
├── monitoring/datadog/        # 4 dashboards + import README
├── scripts/                   # backup, restore, demo-reset, openapi check
├── legal/                     # privacy-policy, terms-of-service templates
└── docs/
    ├── PLAN.md, STATE.md      # milestone roster + live state
    ├── decisions/             # 4 ADRs
    ├── specs/                 # one per milestone (or batch)
    ├── sessions/              # append-only session logs
    ├── runbook.md             # dev procedures
    ├── runbook-incidents.md   # production incident response
    ├── openapi.yaml           # full /api/v1 surface
    ├── onboarding-beta.md     # 30-min beta merchant script
    └── launch/                # screenshots, video, listing, checklists
```

## Getting started

### Prerequisites

- Node.js 20+
- PostgreSQL 16+
- Redis 7+
- Shopify Partner account + dev store
- Shopify CLI: `npm install -g @shopify/cli`

### Setup

```bash
git clone https://github.com/navneelbhanot/bundleforge.git
cd bundleforge
npm install
cp .env.example .env             # fill in SHOPIFY_API_KEY/SECRET, DATABASE_URL,
                                 # REDIS_URL, ENCRYPTION_KEY (32 hex bytes)
npx prisma generate
npx prisma migrate dev
npm run db:seed                  # demo bundles, orders, audit log
npm run dev                      # Shopify CLI tunnels + boots the app
```

### Environment

Required env vars (Zod-validated at boot — see `src/config/env.ts`):

- `SHOPIFY_API_KEY`, `SHOPIFY_API_SECRET` — Partners dashboard
- `DATABASE_URL` — Postgres connection string
- `REDIS_URL` — Redis connection string
- `ENCRYPTION_KEY` — 32-byte hex (`openssl rand -hex 32`) for
  AES-256-GCM at rest
- `SENTRY_DSN` (optional), `DATADOG_*` (optional)

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Shopify CLI dev tunnel + Vite + nodemon |
| `npm run build` | tsc + vite build |
| `npm run test` | Vitest run (442 tests) |
| `npm run typecheck` | tsc --noEmit (server + frontend) |
| `npm run lint` | ESLint with jsx-a11y on the frontend |
| `npm run audit:prod` | npm audit, production deps only |
| `npm run docs:openapi` | Lint `docs/openapi.yaml` |
| `npm run db:seed` | Reseed dev shop |
| `npm run db:migrate` | `prisma migrate dev` |
| `npm run worker` | BullMQ worker process |
| `scripts/backup.sh <dir>` | Hourly Postgres logical backup |
| `scripts/restore.sh <file>` | Restore (requires `CONFIRM=yes`) |
| `scripts/demo-reset.sh` | Wipe + reseed dev shop |

## Database

12 tables (`prisma/schema.prisma`):

- **Core:** `shops`, `bundles`, `bundle_items`, `pricing_rules`
- **Orders:** `bundle_orders`
- **Inventory:** `inventory_sync_state`, `inventory_audit_log` (immutable)
- **Analytics:** `analytics_events`, `ab_tests`
- **System:** `sessions`, `billing_subscriptions`, `integrations`

The `inventory_audit_log` table has a Postgres BEFORE-UPDATE trigger
that rejects updates (ADR-0003); DELETE is allowed for GDPR cascade
(ADR-0003a).

## API surface

Full schema in [`docs/openapi.yaml`](docs/openapi.yaml). All `/api/v1/*`
routes require an authenticated Shopify session (App Bridge token →
`validateAuthenticatedSession` → `requireShopSession` populates
`req.shopId`/`req.shopDomain`).

```
GET    /health
GET    /api/v1/bundles              # paginated, sortable (allowlisted)
POST   /api/v1/bundles
GET    /api/v1/bundles/:id
PATCH  /api/v1/bundles/:id
DELETE /api/v1/bundles/:id
POST   /api/v1/bundles/:id/publish
POST   /api/v1/bundles/:id/archive
POST   /api/v1/bundles/import       # 4 importer formats
GET    /api/v1/orders
GET    /api/v1/inventory/audit
GET    /api/v1/inventory/health
GET    /api/v1/analytics/overview
GET    /api/v1/analytics/abtests
GET    /api/v1/settings | PUT
POST   /api/v1/billing/subscribe | /cancel | /change-plan
POST   /api/v1/ai/recommend
POST   /api/v1/gdpr/export          # admin-initiated GDPR Article 20
POST   /api/v1/gdpr/delete-shop     # admin-initiated GDPR Article 17
POST   /api/proxy/bundles/:slug/price   # storefront, App Proxy HMAC-verified
GET    /api/feeds/google.xml        # public Google Merchant feed
```

## Architecture

- **Modular monolith** — Node-side concerns; ADR-0001.
- **Pricing contract** — server engine + Cart Transform Function share
  a JSON contract; cross-runtime parity tests against shared fixtures.
  ADR-0002.
- **Inventory model** — atomic transaction, append-only audit, UPDATE
  trigger, safety-lock workflow. ADR-0003 (+ 0003a for GDPR).
- **Security** — OWASP A01..A10 mapped; AES-256-GCM, HMAC, Zod, sort
  allowlist, per-shop + per-IP rate limits. ADR-0004.

See `docs/decisions/` for the four ADRs and `ARCHITECTURE.md` for the
full design.

## Documentation

- [`docs/PLAN.md`](docs/PLAN.md) — 156-milestone roster.
- [`docs/STATE.md`](docs/STATE.md) — live state + next action.
- [`docs/runbook.md`](docs/runbook.md) — developer procedures.
- [`docs/runbook-incidents.md`](docs/runbook-incidents.md) — incident
  response (sev defs, on-call, common-issue playbook).
- [`docs/openapi.yaml`](docs/openapi.yaml) — API schema.
- [`docs/onboarding-beta.md`](docs/onboarding-beta.md) — beta merchant
  walkthrough.
- [`docs/launch/`](docs/launch/) — App Store assets, listing copy,
  submission + launch checklists.
- [`legal/`](legal/) — privacy policy + ToS templates.
- [`monitoring/datadog/README.md`](monitoring/datadog/README.md) —
  dashboards + recommended monitor thresholds.

## Test status

- **442 / 442 tests passing**, including:
  - Cross-runtime pricing parity vs. shared fixtures
  - Inventory concurrency property test (mutex'd fake repo)
  - Webhook throughput synthetic (100 acks under 5 s)
  - Pricing invariants over 200 random inputs
  - GDPR endpoints (tenant scope + redaction)
  - Per-IP rate-limit abuse test
  - Frontend axe-core smoke tests

## License

Proprietary. All rights reserved.
