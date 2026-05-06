-- M-174: Per-bundle merchant action trail.
--
-- Append-only by convention (the model has no `updatedAt`); the
-- service code never updates rows. Rows cascade on bundle/shop
-- delete so a redacted shop's activity disappears with it
-- (matches the GDPR posture for inventory_audit_log already
-- relaxed in ADR-0003a). Index supports the only access
-- pattern: list activity for a bundle, newest first.
CREATE TABLE "bundle_activity_log" (
    "id" UUID NOT NULL,
    "shop_id" UUID NOT NULL,
    "bundle_id" UUID NOT NULL,
    "action" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "metadata" JSONB NOT NULL DEFAULT '{}'::jsonb,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bundle_activity_log_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "bundle_activity_log_shop_id_bundle_id_created_at_idx"
    ON "bundle_activity_log" ("shop_id", "bundle_id", "created_at" DESC);

ALTER TABLE "bundle_activity_log"
    ADD CONSTRAINT "bundle_activity_log_shop_id_fkey"
    FOREIGN KEY ("shop_id") REFERENCES "shops"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "bundle_activity_log"
    ADD CONSTRAINT "bundle_activity_log_bundle_id_fkey"
    FOREIGN KEY ("bundle_id") REFERENCES "bundles"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
