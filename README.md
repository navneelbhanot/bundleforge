# BundleForge

**The most reliable Shopify product bundling app.**

BundleForge is a next-generation Shopify product bundling application built to deliver enterprise-grade inventory reliability with consumer-grade simplicity. It addresses every weakness discovered across 12,000+ reviews of competing apps while matching full feature parity.

## Key Differentiators

- **Zero-Downtime Inventory Engine** - Transactional sync with atomic operations, rollback, and audit logging
- **Checkout Guardian** - Pre-validates bundle composition before payment processing
- **Visual Bundle Builder** - Drag-and-drop UI eliminates CSV confusion
- **Multilingual From Day One** - 6+ languages in admin and storefront
- **Embedded Live Support** - Real-time chat + AI diagnostics inside the app
- **AI Bundle Intelligence** - Predictive analytics, seasonal suggestions, margin optimization

## Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js 20 + TypeScript |
| Backend | Express.js + Shopify App Express |
| Frontend | React 18 + Shopify Polaris 12 |
| Database | PostgreSQL 16 (Prisma ORM) |
| Cache/Queue | Redis 7 + BullMQ |
| Functions | Shopify Functions (Cart Transform) |
| Theme | Theme App Extensions (Liquid + Web Components) |
| AI | Python microservice (scikit-learn) |
| CI/CD | GitHub Actions |

## Project Structure

```
bundleforge/
├── prisma/                    # Database schema & migrations
│   └── schema.prisma          # Prisma schema (12 models)
├── src/
│   ├── server/                # Express server entry point
│   ├── config/                # Environment, database, Redis, logger
│   ├── routes/                # API route handlers
│   ├── services/              # Business logic per domain
│   │   ├── bundles/           # Bundle CRUD, publishing, import
│   │   ├── inventory/         # Transactional sync, audit trail
│   │   ├── orders/            # SKU breakdown, fulfillment
│   │   ├── analytics/         # Revenue tracking, A/B tests
│   │   ├── billing/           # Shopify Billing API
│   │   ├── integrations/      # 3PL, ShipStation, Klaviyo
│   │   └── ai/                # Recommendation engine client
│   ├── middleware/             # Auth, rate limiting, error handling
│   ├── webhooks/              # Shopify webhook handlers
│   ├── jobs/                  # BullMQ background workers
│   ├── types/                 # TypeScript type definitions
│   └── utils/                 # Encryption, helpers
├── extensions/
│   ├── theme-extension/       # Storefront App Blocks
│   └── cart-transform/        # Shopify Functions (Rust/JS)
├── tests/                     # Unit, integration, E2E tests
├── docs/                      # Architecture docs, API specs
├── .github/workflows/         # CI/CD pipeline
└── scripts/                   # Migration, seed, utilities
```

## Getting Started

### Prerequisites

- Node.js 20+
- PostgreSQL 16+
- Redis 7+
- Shopify Partner Account
- Shopify CLI (`npm install -g @shopify/cli @shopify/app`)

### Setup

```bash
# Clone the repo
git clone https://github.com/AshDevFr/bundleforge.git
cd bundleforge

# Install dependencies
npm install

# Set up environment
cp .env.example .env
# Edit .env with your credentials

# Generate Prisma client
npx prisma generate

# Run migrations
npx prisma migrate dev

# Start development
npm run dev
```

### Environment Variables

Copy `.env.example` to `.env` and configure:

- `SHOPIFY_API_KEY` / `SHOPIFY_API_SECRET` - From Shopify Partner Dashboard
- `DATABASE_URL` - PostgreSQL connection string
- `REDIS_URL` - Redis connection string
- `ENCRYPTION_KEY` - 32-byte hex key for AES-256 encryption

## Database Schema

12 tables across 5 domains:

- **Core:** shops, bundles, bundle_items, pricing_rules
- **Orders:** bundle_orders
- **Inventory:** inventory_sync_state, inventory_audit_log (immutable)
- **Analytics:** analytics_events, ab_tests
- **System:** sessions, billing_subscriptions, integrations

## API Endpoints

22 REST endpoints across 4 domains. All routes require authenticated Shopify session.

```
GET    /api/v1/bundles              # List bundles (paginated)
POST   /api/v1/bundles              # Create bundle
GET    /api/v1/bundles/:id          # Get bundle detail
PUT    /api/v1/bundles/:id          # Update bundle
DELETE /api/v1/bundles/:id          # Soft delete
POST   /api/v1/bundles/:id/publish  # Activate & sync to Shopify
POST   /api/v1/bundles/:id/archive  # Archive bundle
POST   /api/v1/bundles/import       # Bulk import / migration
GET    /api/v1/orders               # List bundle orders
GET    /api/v1/inventory/audit      # Inventory audit trail
GET    /api/v1/analytics/overview   # Dashboard analytics
GET    /api/v1/ai/recommendations   # AI bundle suggestions
GET    /health                      # Health check
```

## Development Roadmap

- **Phase 1 (M1-2):** Core architecture, OAuth, Billing, bundle CRUD
- **Phase 2 (M2-3):** Visual builder, all bundle types, pricing engine
- **Phase 3 (M3-4):** Inventory engine, Checkout Guardian, 3PL
- **Phase 4 (M4-5):** Analytics, AI, multilingual, theme extensions
- **Phase 5 (M5-6):** Beta testing, optimization, App Store submission

## License

Proprietary. All rights reserved.
