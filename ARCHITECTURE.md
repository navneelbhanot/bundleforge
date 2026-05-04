# BundleForge — Technical Architecture & Database Schema

> Version 1.0 | March 2026 | Engineering Document

---

## 1. Technology Stack

| Layer | Technology | Rationale |
|---|---|---|
| Runtime | Node.js 20 LTS + TypeScript 5.x | Shopify's recommended stack; type safety |
| Backend Framework | Express.js + @shopify/shopify-app-express | Official Shopify app template; battle-tested |
| Frontend | React 18 + Shopify Polaris 12 | Mandatory for App Store approval (Polaris) |
| Router | React Router v6 (file-based via Remix) | Shopify template default; SSR support |
| ORM | Prisma 5.x | Type-safe queries, auto-migrations, Shopify docs endorse |
| Database | PostgreSQL 16 (Neon / Supabase) | ACID transactions, JSONB support for flexible bundle config |
| Cache / Queue | Redis 7 (Upstash) + BullMQ | Session cache, rate limiting, async order processing |
| Shopify Functions | Rust / JavaScript (Wasm) | Cart Transform for bundle pricing at checkout |
| Theme Extensions | Liquid + Web Components + App Blocks | Storefront display without manual code edits |
| App Bridge | @shopify/app-bridge-react 4.x | Embedded app within Shopify Admin |
| Auth | OAuth 2.0 via Shopify CLI / shopify-api-js | Mandatory for App Store; handles token refresh |
| Billing | Shopify Billing API (GraphQL) | Required for paid plans; handles subscription lifecycle |
| AI/ML Service | Python 3.12 + scikit-learn (microservice) | Bundle recommendation engine; isolated from main app |
| Testing | Vitest + Playwright + Shopify CLI tests | Unit, integration, E2E; Shopify-compatible |
| CI/CD | GitHub Actions | Auto test, lint, deploy on push to main |
| Monitoring | Sentry (errors) + Datadog (metrics) | Real-time error tracking, performance monitoring |

---

## 2. System Architecture

### 2.1 High-Level Overview

BundleForge follows a **modular monolith** architecture with clearly separated domain modules. Each domain (Bundles, Inventory, Orders, Analytics, Integrations) has its own service layer, repository, and routes, but shares a single database and deployment.

The one exception is the **AI Recommendation Engine**, which runs as a separate lightweight Python microservice to prevent ML workloads from impacting core app latency.

### 2.2 System Components

| Component | Responsibility | Communication |
|---|---|---|
| App Server | Core API, Auth, Admin UI, Billing | HTTP REST + GraphQL Proxy to Shopify |
| Bundle Engine | CRUD, validation, pricing rules, variant mgmt | Internal service calls within monolith |
| Inventory Engine | Atomic sync, audit trail, safety locks | Shopify Inventory API + webhooks |
| Order Processor | SKU breakdown, fulfillment, Checkout Guardian | BullMQ async jobs + Shopify Order API |
| Analytics Service | Revenue tracking, A/B tests, conversion rates | Reads from analytics tables (materialized views) |
| Cart Transform Fn | Applies bundle pricing at Shopify checkout | Shopify Functions (Wasm, runs on Shopify infra) |
| Theme Extension | Storefront bundle display, variant selectors | App Blocks + App Proxy for dynamic data |
| AI Recommender | FBT suggestions, seasonal bundles, margin opt | REST API called from App Server; Python/Flask |
| Webhook Handler | Processes Shopify events (orders, products, etc.) | Express routes + BullMQ job dispatch |
| Background Workers | Async order processing, inventory sync, reports | BullMQ workers consuming Redis queue |

### 2.3 Core Data Flows

#### Flow 1: Merchant Creates a Bundle

1. Merchant opens BundleForge admin -> Polaris React UI renders in Shopify Admin (App Bridge)
2. Merchant uses Visual Builder to compose bundle (drag products, set pricing rules)
3. Frontend sends `POST /api/bundles` to App Server
4. Bundle Engine validates config, creates records in `bundles`, `bundle_items`, `pricing_rules` tables
5. Bundle Engine calls Shopify Admin API to create/update the bundle product in Shopify
6. Bundle Engine writes bundle metafields to Shopify product (used by Cart Transform)
7. Theme Extension auto-renders bundle display on the storefront product page

#### Flow 2: Customer Purchases a Bundle

1. Customer adds bundle to cart on storefront
2. Shopify Functions (Cart Transform) reads bundle metafields, calculates discounted price
3. Customer proceeds to checkout -> Checkout Guardian validates bundle integrity
4. Payment processed by Shopify Checkout
5. Shopify fires `orders/create` webhook to BundleForge
6. Webhook Handler dispatches job to BullMQ order processing queue
7. Order Processor breaks bundle into individual SKUs (SKU Breakdown)
8. Inventory Engine atomically decrements component stock (with audit log entry)
9. If 3PL integration active: forwards broken-down SKUs to ShipStation/WMS API
10. Analytics Service records sale event, updates conversion metrics

#### Flow 3: Inventory Sync (Transactional)

1. Shopify fires `inventory_levels/update` webhook
2. Inventory Engine receives event, starts database `TRANSACTION`
3. Recalculates available bundle quantities based on component stock levels
4. Updates bundle product availability in Shopify via Admin API
5. Writes audit log entry with before/after values and change reason
6. `COMMITS` transaction (or `ROLLS BACK` on any error, zero partial updates)
7. If Safety Lock enabled: queues change for merchant approval before committing

---

## 3. Database Schema (PostgreSQL)

All tables use UUIDs as primary keys. Timestamps use `TIMESTAMPTZ`. Shopify GIDs are stored as `TEXT`. The schema uses Prisma ORM for type-safe access and automatic migrations.

**Schema Design Principles:**

- ACID transactions for all inventory operations, no eventual consistency
- JSONB columns for flexible bundle configuration (avoids rigid schema for variant options)
- Separate audit trail table with immutable INSERT-only pattern
- Soft deletes (`deleted_at`) on merchant-facing tables; hard deletes on internal tables
- Composite indexes on `(shop_id, created_at)` for all merchant-scoped queries
- Shopify GIDs stored alongside internal IDs to maintain bidirectional sync

### 3.1 Core Tables

#### `shops`

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | UUID | PK, DEFAULT uuid_generate_v4() | Internal unique identifier |
| shopify_domain | TEXT | UNIQUE, NOT NULL | mystore.myshopify.com |
| shopify_gid | TEXT | UNIQUE, NOT NULL | Shopify global ID (gid://shopify/Shop/123) |
| access_token | TEXT | NOT NULL, ENCRYPTED | Shopify OAuth access token (AES-256 encrypted) |
| name | TEXT | NOT NULL | Store display name |
| email | TEXT | NOT NULL | Store owner email |
| plan_name | TEXT | NOT NULL, DEFAULT 'starter' | BundleForge plan: starter/growth/pro/enterprise |
| shopify_plan | TEXT | | Shopify plan: basic/shopify/advanced/plus |
| currency | TEXT | NOT NULL, DEFAULT 'USD' | Store primary currency |
| timezone | TEXT | NOT NULL, DEFAULT 'UTC' | Store timezone for analytics |
| locale | TEXT | NOT NULL, DEFAULT 'en' | Admin UI language preference |
| settings | JSONB | DEFAULT '{}' | Shop-level settings (safety_lock, notifications, etc.) |
| installed_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | First install timestamp |
| uninstalled_at | TIMESTAMPTZ | NULLABLE | Uninstall timestamp (soft state) |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | Record creation |
| updated_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | Last update |

#### `bundles`

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | UUID | PK | Internal bundle ID |
| shop_id | UUID | FK -> shops.id, NOT NULL | Owning shop |
| shopify_product_gid | TEXT | NULLABLE | Shopify product GID if synced |
| shopify_product_id | BIGINT | NULLABLE | Numeric Shopify product ID |
| title | TEXT | NOT NULL | Bundle display title |
| slug | TEXT | NOT NULL | URL-friendly slug |
| description | TEXT | | Bundle description (supports HTML) |
| type | TEXT | NOT NULL | fixed, mix_match, bogo, bxgy, volume, build_box, multipack, gift, mystery, sample, subscription, wholesale, custom |
| status | TEXT | NOT NULL, DEFAULT 'draft' | draft, active, archived, deleted |
| image_url | TEXT | NULLABLE | Bundle hero image URL |
| config | JSONB | NOT NULL, DEFAULT '{}' | Flexible config: min/max items, step rules, constraints |
| display_settings | JSONB | DEFAULT '{}' | Widget styling, layout preferences |
| seo_title | TEXT | NULLABLE | SEO meta title |
| seo_description | TEXT | NULLABLE | SEO meta description |
| priority | INT | DEFAULT 0 | Sort priority for display |
| starts_at | TIMESTAMPTZ | NULLABLE | Scheduled start (flash bundles) |
| ends_at | TIMESTAMPTZ | NULLABLE | Scheduled end (flash bundles) |
| deleted_at | TIMESTAMPTZ | NULLABLE | Soft delete timestamp |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | Record creation |
| updated_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | Last update |

#### `bundle_items`

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | UUID | PK | Internal item ID |
| bundle_id | UUID | FK -> bundles.id, NOT NULL | Parent bundle |
| shopify_product_gid | TEXT | NOT NULL | Shopify product GID |
| shopify_variant_gid | TEXT | NULLABLE | Specific variant GID (null = all variants) |
| title | TEXT | NOT NULL | Product/variant title (cached) |
| sku | TEXT | NULLABLE | SKU for fulfillment breakdown |
| quantity | INT | NOT NULL, DEFAULT 1 | Quantity of this item in bundle |
| is_required | BOOLEAN | DEFAULT true | Required or optional in mix-match |
| is_default | BOOLEAN | DEFAULT false | Pre-selected in build-a-box |
| position | INT | NOT NULL, DEFAULT 0 | Sort order within bundle |
| group_name | TEXT | NULLABLE | Step/group for build-a-box (e.g., "Step 1: Pick a top") |
| min_quantity | INT | DEFAULT 0 | Min selectable quantity (mix-match) |
| max_quantity | INT | NULLABLE | Max selectable quantity (mix-match) |
| price_override | DECIMAL(12,2) | NULLABLE | Override price for this specific item |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | Record creation |
| updated_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | Last update |

#### `pricing_rules`

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | UUID | PK | Internal rule ID |
| bundle_id | UUID | FK -> bundles.id, NOT NULL | Associated bundle |
| type | TEXT | NOT NULL | fixed, percentage, flat_discount, tiered, volume, bogo, custom |
| value | DECIMAL(12,2) | NOT NULL | Discount value (amount or percentage) |
| min_quantity | INT | DEFAULT 1 | Min items for this rule to trigger |
| max_quantity | INT | NULLABLE | Max items for this rule |
| min_cart_value | DECIMAL(12,2) | NULLABLE | Min cart value trigger |
| conditions | JSONB | DEFAULT '{}' | Advanced conditions: customer_tags, geo, dates |
| priority | INT | DEFAULT 0 | Rule evaluation priority (highest wins) |
| is_stackable | BOOLEAN | DEFAULT false | Can stack with other Shopify discounts |
| starts_at | TIMESTAMPTZ | NULLABLE | Rule activation time |
| ends_at | TIMESTAMPTZ | NULLABLE | Rule expiration time |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | Record creation |
| updated_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | Last update |

#### `bundle_orders`

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | UUID | PK | Internal order ID |
| shop_id | UUID | FK -> shops.id, NOT NULL | Owning shop |
| bundle_id | UUID | FK -> bundles.id, NOT NULL | Bundle that was purchased |
| shopify_order_gid | TEXT | UNIQUE, NOT NULL | Shopify order GID |
| shopify_order_id | BIGINT | NOT NULL | Numeric Shopify order ID |
| shopify_order_number | TEXT | NOT NULL | Customer-facing order number (#1001) |
| customer_id | TEXT | NULLABLE | Shopify customer GID |
| status | TEXT | NOT NULL, DEFAULT 'pending' | pending, processed, fulfilled, cancelled, error |
| bundle_price | DECIMAL(12,2) | NOT NULL | Price customer paid for bundle |
| original_price | DECIMAL(12,2) | NOT NULL | Sum of individual item prices (pre-discount) |
| discount_amount | DECIMAL(12,2) | NOT NULL | Discount applied |
| currency | TEXT | NOT NULL | Order currency |
| line_items | JSONB | NOT NULL | Snapshot of bundle items at time of purchase |
| sku_breakdown | JSONB | NOT NULL | Broken-down SKUs for fulfillment |
| fulfillment_status | TEXT | DEFAULT 'unfulfilled' | unfulfilled, partial, fulfilled |
| metadata | JSONB | DEFAULT '{}' | Custom metafields, notes, tags |
| processed_at | TIMESTAMPTZ | NULLABLE | When SKU breakdown was completed |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | Record creation |
| updated_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | Last update |

### 3.2 Inventory Tables

#### `inventory_sync_state`

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | UUID | PK | Internal ID |
| shop_id | UUID | FK -> shops.id, NOT NULL | Owning shop |
| bundle_id | UUID | FK -> bundles.id, NOT NULL | Associated bundle |
| shopify_inventory_item_gid | TEXT | NOT NULL | Shopify inventory item GID |
| location_gid | TEXT | NOT NULL | Shopify location GID |
| available_quantity | INT | NOT NULL, DEFAULT 0 | Current available stock |
| committed_quantity | INT | NOT NULL, DEFAULT 0 | Reserved but not fulfilled |
| last_synced_at | TIMESTAMPTZ | NOT NULL | Last successful sync timestamp |
| sync_status | TEXT | NOT NULL, DEFAULT 'synced' | synced, pending, error, locked |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | Record creation |
| updated_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | Last update |

#### `inventory_audit_log` (IMMUTABLE -- INSERT ONLY)

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | UUID | PK | Audit entry ID |
| shop_id | UUID | FK -> shops.id, NOT NULL | Owning shop |
| bundle_id | UUID | FK -> bundles.id, NULLABLE | Related bundle (if applicable) |
| shopify_inventory_item_gid | TEXT | NOT NULL | Affected inventory item |
| location_gid | TEXT | NOT NULL | Affected location |
| action | TEXT | NOT NULL | adjust, set, reserve, release, sync, rollback |
| quantity_before | INT | NOT NULL | Stock level before change |
| quantity_after | INT | NOT NULL | Stock level after change |
| quantity_delta | INT | NOT NULL | Change amount (+/-) |
| reason | TEXT | NOT NULL | order_placed, order_cancelled, manual_adjust, sync, bundle_created, safety_lock |
| source | TEXT | NOT NULL | webhook, admin, api, system, migration |
| reference_id | TEXT | NULLABLE | Order ID, bundle ID, or other reference |
| metadata | JSONB | DEFAULT '{}' | Additional context |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | Immutable timestamp |

### 3.3 Analytics Tables

#### `analytics_events`

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | UUID | PK | Event ID |
| shop_id | UUID | FK -> shops.id, NOT NULL | Owning shop |
| bundle_id | UUID | FK -> bundles.id, NOT NULL | Related bundle |
| event_type | TEXT | NOT NULL | view, add_to_cart, checkout_start, purchase, remove |
| session_id | TEXT | NULLABLE | Customer session identifier |
| customer_id | TEXT | NULLABLE | Shopify customer GID |
| revenue | DECIMAL(12,2) | DEFAULT 0 | Revenue generated (for purchase events) |
| currency | TEXT | NULLABLE | Event currency |
| device_type | TEXT | NULLABLE | desktop, mobile, tablet |
| source_page | TEXT | NULLABLE | product, collection, cart, custom |
| ab_variant | TEXT | NULLABLE | A/B test variant (A, B, control) |
| metadata | JSONB | DEFAULT '{}' | Extra event data |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | Event timestamp |

#### `ab_tests`

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | UUID | PK | Test ID |
| shop_id | UUID | FK -> shops.id, NOT NULL | Owning shop |
| bundle_id | UUID | FK -> bundles.id, NOT NULL | Bundle being tested |
| name | TEXT | NOT NULL | Test name (e.g., "10% vs 15% discount") |
| status | TEXT | NOT NULL, DEFAULT 'draft' | draft, running, completed, cancelled |
| variant_a_config | JSONB | NOT NULL | Config for variant A |
| variant_b_config | JSONB | NOT NULL | Config for variant B |
| traffic_split | DECIMAL(3,2) | DEFAULT 0.50 | % traffic to variant B |
| metric | TEXT | NOT NULL, DEFAULT 'conversion_rate' | Primary metric to optimize |
| started_at | TIMESTAMPTZ | NULLABLE | Test start |
| ended_at | TIMESTAMPTZ | NULLABLE | Test end |
| winner | TEXT | NULLABLE | A, B, inconclusive |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | Record creation |

### 3.4 Integration Tables

#### `integrations`

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | UUID | PK | Integration ID |
| shop_id | UUID | FK -> shops.id, NOT NULL | Owning shop |
| type | TEXT | NOT NULL | shipstation, amazon, recharge, bold, klaviyo, google_merchant, custom_3pl |
| status | TEXT | NOT NULL, DEFAULT 'inactive' | active, inactive, error |
| credentials | JSONB | NOT NULL, ENCRYPTED | API keys, tokens (AES-256) |
| settings | JSONB | DEFAULT '{}' | Integration-specific settings |
| last_synced_at | TIMESTAMPTZ | NULLABLE | Last successful sync |
| error_message | TEXT | NULLABLE | Last error message |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | Record creation |
| updated_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | Last update |

### 3.5 Sessions & Billing Tables

#### `sessions`

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | TEXT | PK | Shopify session ID |
| shop | TEXT | NOT NULL | Store domain |
| state | TEXT | NOT NULL | OAuth state parameter |
| is_online | BOOLEAN | DEFAULT false | Online vs offline session |
| scope | TEXT | NULLABLE | Granted API scopes |
| access_token | TEXT | NULLABLE, ENCRYPTED | Session access token |
| expires | TIMESTAMPTZ | NULLABLE | Token expiration |
| account_owner | BOOLEAN | DEFAULT false | Is account owner |
| collaborator | BOOLEAN | DEFAULT false | Is collaborator |

#### `billing_subscriptions`

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | UUID | PK | Internal billing ID |
| shop_id | UUID | FK -> shops.id, UNIQUE, NOT NULL | Owning shop (1:1) |
| shopify_charge_id | TEXT | NOT NULL | Shopify recurring charge ID |
| plan_name | TEXT | NOT NULL | starter, growth, pro, enterprise |
| price | DECIMAL(8,2) | NOT NULL | Monthly price |
| billing_interval | TEXT | NOT NULL, DEFAULT 'monthly' | monthly, annual |
| status | TEXT | NOT NULL | active, pending, cancelled, frozen, expired |
| trial_days | INT | DEFAULT 0 | Trial period days |
| trial_ends_at | TIMESTAMPTZ | NULLABLE | Trial end date |
| activated_at | TIMESTAMPTZ | NULLABLE | Subscription activation |
| cancelled_at | TIMESTAMPTZ | NULLABLE | Cancellation timestamp |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | Record creation |
| updated_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | Last update |

---

## 4. Database Indexes

| Table | Index | Purpose |
|---|---|---|
| bundles | (shop_id, status, created_at DESC) | Dashboard listing |
| bundles | (shop_id, type) | Filter by type |
| bundles | (shopify_product_gid) UNIQUE | Shopify sync lookup |
| bundle_items | (bundle_id, position) | Ordered item fetch |
| bundle_items | (shopify_product_gid) | Product lookup |
| bundle_orders | (shop_id, created_at DESC) | Order listing |
| bundle_orders | (shopify_order_gid) UNIQUE | Webhook dedup |
| bundle_orders | (bundle_id, status) | Bundle order stats |
| inventory_audit_log | (shop_id, created_at DESC) | Audit trail query |
| inventory_audit_log | (shopify_inventory_item_gid, created_at) | Item history |
| analytics_events | (shop_id, bundle_id, event_type, created_at) | Analytics queries |
| analytics_events | (shop_id, created_at) BRIN | Time-range scans |
| inventory_sync_state | (shop_id, bundle_id, location_gid) UNIQUE | Sync state lookup |

---

## 5. API Routes Design

All routes are prefixed with `/api/v1` and require authenticated Shopify session.

### 5.1 Bundle Management

| Method | Route | Description |
|---|---|---|
| GET | /bundles | List all bundles (paginated, filterable, sortable) |
| POST | /bundles | Create new bundle with items and pricing rules |
| GET | /bundles/:id | Get bundle detail with items, rules, analytics |
| PUT | /bundles/:id | Update bundle config, items, pricing |
| DELETE | /bundles/:id | Soft delete bundle (sets deleted_at) |
| POST | /bundles/:id/duplicate | Clone bundle with new ID |
| POST | /bundles/:id/publish | Set status to active, sync to Shopify |
| POST | /bundles/:id/archive | Archive bundle (remove from storefront) |
| POST | /bundles/import | Bulk import from CSV or competitor migration |

### 5.2 Orders & Inventory

| Method | Route | Description |
|---|---|---|
| GET | /orders | List bundle orders (paginated) |
| GET | /orders/:id | Order detail with SKU breakdown |
| GET | /inventory/audit | Inventory audit trail (paginated, filterable) |
| POST | /inventory/sync | Force manual inventory sync for all bundles |
| GET | /inventory/health | Inventory health check dashboard data |

### 5.3 Analytics & Settings

| Method | Route | Description |
|---|---|---|
| GET | /analytics/overview | Dashboard: total revenue, AOV, conversion rates |
| GET | /analytics/bundles/:id | Per-bundle analytics with time series |
| GET | /analytics/ab-tests | List A/B tests with results |
| POST | /analytics/ab-tests | Create new A/B test |
| GET | /settings | Get shop settings |
| PUT | /settings | Update shop settings |
| GET | /ai/recommendations | Get AI bundle suggestions |

### 5.4 Webhook Endpoints

| Webhook Topic | Handler Action |
|---|---|
| orders/create | Dispatch order processing job (SKU breakdown + inventory adjust) |
| orders/updated | Update order status, handle cancellations/refunds |
| orders/cancelled | Reverse inventory adjustments, update analytics |
| products/update | Sync product title/price/image changes to bundle items |
| products/delete | Flag affected bundles, notify merchant |
| inventory_levels/update | Recalculate bundle availability, update sync state |
| app/uninstalled | Mark shop uninstalled, cleanup scheduled jobs |
| shop/update | Update shop settings (currency, timezone, plan) |

---

## 6. Security Architecture

- All API endpoints require valid Shopify session token (verified via @shopify/shopify-api)
- Access tokens encrypted at rest using AES-256-GCM with key rotation support
- Integration credentials stored encrypted in JSONB columns
- HMAC verification on all incoming Shopify webhooks
- CSRF protection via Shopify App Bridge token exchange
- Rate limiting: 100 requests/minute per shop (Redis-backed)
- SQL injection prevention via Prisma parameterized queries
- XSS prevention via React's built-in escaping + Content Security Policy headers
- HTTPS enforced on all endpoints (TLS 1.3)
- GDPR/CCPA compliance: data export and deletion endpoints per Shopify requirements
- Audit log is immutable (INSERT-only, no UPDATE/DELETE permissions on table)
- Shopify mandatory webhooks: customers/data_request, customers/redact, shop/redact

---

## 7. Entity Relationship Summary

The database schema contains 12 primary tables organized into 5 domains:

- **Core Domain:** shops (1) -> bundles (many) -> bundle_items (many), pricing_rules (many)
- **Order Domain:** shops (1) -> bundle_orders (many) <-> bundles (many-to-one)
- **Inventory Domain:** inventory_sync_state (per bundle per location), inventory_audit_log (immutable trail)
- **Analytics Domain:** analytics_events (high-volume event stream), ab_tests (experiment configs)
- **System Domain:** sessions (Shopify auth), billing_subscriptions (plan management), integrations (3PL configs)

Every table with merchant data includes `shop_id` as a foreign key and is indexed on `(shop_id, created_at DESC)` for efficient tenant-scoped queries. The `inventory_audit_log` table has no UPDATE or DELETE permissions, ensuring an immutable record of all inventory changes. This is the core architectural defense against the inventory reset bugs that plague competitors.
