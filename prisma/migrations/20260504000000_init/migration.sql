-- CreateTable
CREATE TABLE "shops" (
    "id" UUID NOT NULL,
    "shopify_domain" TEXT NOT NULL,
    "shopify_gid" TEXT NOT NULL,
    "access_token" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "plan_name" TEXT NOT NULL DEFAULT 'starter',
    "shopify_plan" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "locale" TEXT NOT NULL DEFAULT 'en',
    "settings" JSONB NOT NULL DEFAULT '{}',
    "installed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "uninstalled_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shops_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bundles" (
    "id" UUID NOT NULL,
    "shop_id" UUID NOT NULL,
    "shopify_product_gid" TEXT,
    "shopify_product_id" BIGINT,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "image_url" TEXT,
    "config" JSONB NOT NULL DEFAULT '{}',
    "display_settings" JSONB NOT NULL DEFAULT '{}',
    "seo_title" TEXT,
    "seo_description" TEXT,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "starts_at" TIMESTAMP(3),
    "ends_at" TIMESTAMP(3),
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bundles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bundle_items" (
    "id" UUID NOT NULL,
    "bundle_id" UUID NOT NULL,
    "shopify_product_gid" TEXT NOT NULL,
    "shopify_variant_gid" TEXT,
    "title" TEXT NOT NULL,
    "sku" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "is_required" BOOLEAN NOT NULL DEFAULT true,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "position" INTEGER NOT NULL DEFAULT 0,
    "group_name" TEXT,
    "min_quantity" INTEGER NOT NULL DEFAULT 0,
    "max_quantity" INTEGER,
    "price_override" DECIMAL(12,2),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bundle_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pricing_rules" (
    "id" UUID NOT NULL,
    "bundle_id" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "value" DECIMAL(12,2) NOT NULL,
    "min_quantity" INTEGER NOT NULL DEFAULT 1,
    "max_quantity" INTEGER,
    "min_cart_value" DECIMAL(12,2),
    "conditions" JSONB NOT NULL DEFAULT '{}',
    "priority" INTEGER NOT NULL DEFAULT 0,
    "is_stackable" BOOLEAN NOT NULL DEFAULT false,
    "starts_at" TIMESTAMP(3),
    "ends_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pricing_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bundle_orders" (
    "id" UUID NOT NULL,
    "shop_id" UUID NOT NULL,
    "bundle_id" UUID NOT NULL,
    "shopify_order_gid" TEXT NOT NULL,
    "shopify_order_id" BIGINT NOT NULL,
    "shopify_order_number" TEXT NOT NULL,
    "customer_id" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "bundle_price" DECIMAL(12,2) NOT NULL,
    "original_price" DECIMAL(12,2) NOT NULL,
    "discount_amount" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL,
    "line_items" JSONB NOT NULL,
    "sku_breakdown" JSONB NOT NULL,
    "fulfillment_status" TEXT NOT NULL DEFAULT 'unfulfilled',
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "processed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bundle_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_sync_state" (
    "id" UUID NOT NULL,
    "shop_id" UUID NOT NULL,
    "bundle_id" UUID NOT NULL,
    "shopify_inventory_item_gid" TEXT NOT NULL,
    "location_gid" TEXT NOT NULL,
    "available_quantity" INTEGER NOT NULL DEFAULT 0,
    "committed_quantity" INTEGER NOT NULL DEFAULT 0,
    "last_synced_at" TIMESTAMP(3) NOT NULL,
    "sync_status" TEXT NOT NULL DEFAULT 'synced',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inventory_sync_state_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_audit_log" (
    "id" UUID NOT NULL,
    "shop_id" UUID NOT NULL,
    "bundle_id" UUID,
    "shopify_inventory_item_gid" TEXT NOT NULL,
    "location_gid" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "quantity_before" INTEGER NOT NULL,
    "quantity_after" INTEGER NOT NULL,
    "quantity_delta" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "reference_id" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inventory_audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "analytics_events" (
    "id" UUID NOT NULL,
    "shop_id" UUID NOT NULL,
    "bundle_id" UUID NOT NULL,
    "event_type" TEXT NOT NULL,
    "session_id" TEXT,
    "customer_id" TEXT,
    "revenue" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "currency" TEXT,
    "device_type" TEXT,
    "source_page" TEXT,
    "ab_variant" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "analytics_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ab_tests" (
    "id" UUID NOT NULL,
    "shop_id" UUID NOT NULL,
    "bundle_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "variant_a_config" JSONB NOT NULL,
    "variant_b_config" JSONB NOT NULL,
    "traffic_split" DECIMAL(3,2) NOT NULL DEFAULT 0.50,
    "metric" TEXT NOT NULL DEFAULT 'conversion_rate',
    "started_at" TIMESTAMP(3),
    "ended_at" TIMESTAMP(3),
    "winner" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ab_tests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "integrations" (
    "id" UUID NOT NULL,
    "shop_id" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'inactive',
    "credentials" JSONB NOT NULL,
    "settings" JSONB NOT NULL DEFAULT '{}',
    "last_synced_at" TIMESTAMP(3),
    "error_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "integrations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "billing_subscriptions" (
    "id" UUID NOT NULL,
    "shop_id" UUID NOT NULL,
    "shopify_charge_id" TEXT NOT NULL,
    "plan_name" TEXT NOT NULL,
    "price" DECIMAL(8,2) NOT NULL,
    "billing_interval" TEXT NOT NULL DEFAULT 'monthly',
    "status" TEXT NOT NULL,
    "trial_days" INTEGER NOT NULL DEFAULT 0,
    "trial_ends_at" TIMESTAMP(3),
    "activated_at" TIMESTAMP(3),
    "cancelled_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "billing_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "is_online" BOOLEAN NOT NULL DEFAULT false,
    "scope" TEXT,
    "access_token" TEXT,
    "expires" TIMESTAMP(3),
    "account_owner" BOOLEAN NOT NULL DEFAULT false,
    "collaborator" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "shops_shopify_domain_key" ON "shops"("shopify_domain");

-- CreateIndex
CREATE UNIQUE INDEX "shops_shopify_gid_key" ON "shops"("shopify_gid");

-- CreateIndex
CREATE UNIQUE INDEX "bundles_shopify_product_gid_key" ON "bundles"("shopify_product_gid");

-- CreateIndex
CREATE INDEX "bundles_shop_id_status_created_at_idx" ON "bundles"("shop_id", "status", "created_at" DESC);

-- CreateIndex
CREATE INDEX "bundles_shop_id_type_idx" ON "bundles"("shop_id", "type");

-- CreateIndex
CREATE INDEX "bundles_status_starts_at_ends_at_idx" ON "bundles"("status", "starts_at", "ends_at");

-- CreateIndex
CREATE INDEX "bundle_items_bundle_id_position_idx" ON "bundle_items"("bundle_id", "position");

-- CreateIndex
CREATE INDEX "bundle_items_shopify_product_gid_idx" ON "bundle_items"("shopify_product_gid");

-- CreateIndex
CREATE INDEX "pricing_rules_bundle_id_priority_idx" ON "pricing_rules"("bundle_id", "priority" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "bundle_orders_shopify_order_gid_key" ON "bundle_orders"("shopify_order_gid");

-- CreateIndex
CREATE INDEX "bundle_orders_shop_id_created_at_idx" ON "bundle_orders"("shop_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "bundle_orders_bundle_id_status_idx" ON "bundle_orders"("bundle_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_sync_state_shop_id_bundle_id_location_gid_key" ON "inventory_sync_state"("shop_id", "bundle_id", "location_gid");

-- CreateIndex
CREATE INDEX "inventory_audit_log_shop_id_created_at_idx" ON "inventory_audit_log"("shop_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "inventory_audit_log_shopify_inventory_item_gid_created_at_idx" ON "inventory_audit_log"("shopify_inventory_item_gid", "created_at");

-- CreateIndex
CREATE INDEX "analytics_events_shop_id_bundle_id_event_type_created_at_idx" ON "analytics_events"("shop_id", "bundle_id", "event_type", "created_at");

-- CreateIndex
CREATE INDEX "analytics_events_shop_id_created_at_idx" ON "analytics_events"("shop_id", "created_at");

-- CreateIndex
CREATE INDEX "ab_tests_shop_id_status_idx" ON "ab_tests"("shop_id", "status");

-- CreateIndex
CREATE INDEX "integrations_shop_id_type_idx" ON "integrations"("shop_id", "type");

-- CreateIndex
CREATE UNIQUE INDEX "billing_subscriptions_shop_id_key" ON "billing_subscriptions"("shop_id");

-- CreateIndex
CREATE INDEX "sessions_shop_idx" ON "sessions"("shop");

-- AddForeignKey
ALTER TABLE "bundles" ADD CONSTRAINT "bundles_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "shops"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bundle_items" ADD CONSTRAINT "bundle_items_bundle_id_fkey" FOREIGN KEY ("bundle_id") REFERENCES "bundles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pricing_rules" ADD CONSTRAINT "pricing_rules_bundle_id_fkey" FOREIGN KEY ("bundle_id") REFERENCES "bundles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bundle_orders" ADD CONSTRAINT "bundle_orders_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "shops"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bundle_orders" ADD CONSTRAINT "bundle_orders_bundle_id_fkey" FOREIGN KEY ("bundle_id") REFERENCES "bundles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_sync_state" ADD CONSTRAINT "inventory_sync_state_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "shops"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_sync_state" ADD CONSTRAINT "inventory_sync_state_bundle_id_fkey" FOREIGN KEY ("bundle_id") REFERENCES "bundles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_audit_log" ADD CONSTRAINT "inventory_audit_log_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "shops"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_audit_log" ADD CONSTRAINT "inventory_audit_log_bundle_id_fkey" FOREIGN KEY ("bundle_id") REFERENCES "bundles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "analytics_events" ADD CONSTRAINT "analytics_events_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "shops"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "analytics_events" ADD CONSTRAINT "analytics_events_bundle_id_fkey" FOREIGN KEY ("bundle_id") REFERENCES "bundles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ab_tests" ADD CONSTRAINT "ab_tests_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "shops"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ab_tests" ADD CONSTRAINT "ab_tests_bundle_id_fkey" FOREIGN KEY ("bundle_id") REFERENCES "bundles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "integrations" ADD CONSTRAINT "integrations_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "shops"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "billing_subscriptions" ADD CONSTRAINT "billing_subscriptions_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "shops"("id") ON DELETE CASCADE ON UPDATE CASCADE;

