-- M-168: api_tokens + outbound_webhooks
--
-- New tables surfaced by the Settings · API & webhooks tab.
-- Reviewed before applying per CLAUDE.md §5.

-- ----------------------------- api_tokens -----------------------------

CREATE TABLE "api_tokens" (
    "id" UUID NOT NULL,
    "shop_id" UUID NOT NULL,
    "label" TEXT NOT NULL,
    "prefix" TEXT NOT NULL,
    "hashed_token" TEXT NOT NULL,
    "last_used_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revoked_at" TIMESTAMP(3),

    CONSTRAINT "api_tokens_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "api_tokens_shop_id_revoked_at_idx" ON "api_tokens"("shop_id", "revoked_at");

ALTER TABLE "api_tokens"
    ADD CONSTRAINT "api_tokens_shop_id_fkey"
    FOREIGN KEY ("shop_id") REFERENCES "shops"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- -------------------------- outbound_webhooks --------------------------

CREATE TABLE "outbound_webhooks" (
    "id" UUID NOT NULL,
    "shop_id" UUID NOT NULL,
    "url" TEXT NOT NULL,
    "events" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "hmac_secret" TEXT NOT NULL,
    "last_fired_at" TIMESTAMP(3),
    "fail_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "disabled_at" TIMESTAMP(3),

    CONSTRAINT "outbound_webhooks_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "outbound_webhooks_shop_id_idx" ON "outbound_webhooks"("shop_id");

ALTER TABLE "outbound_webhooks"
    ADD CONSTRAINT "outbound_webhooks_shop_id_fkey"
    FOREIGN KEY ("shop_id") REFERENCES "shops"("id") ON DELETE CASCADE ON UPDATE CASCADE;
