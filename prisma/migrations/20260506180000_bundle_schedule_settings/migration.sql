-- M-170: Add bundles.schedule_settings JSON column.
--
-- Stores merchant-configured timezone, recurringRule, and endBehavior.
-- Defaults to {} so existing rows don't need backfill.

ALTER TABLE "bundles"
    ADD COLUMN "schedule_settings" JSONB NOT NULL DEFAULT '{}'::jsonb;
