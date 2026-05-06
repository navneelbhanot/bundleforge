-- M-172: Add bundles.eligibility JSON column.
--
-- Stores per-bundle customer-tag allow/deny lists, Shopify Segment
-- GIDs, requireLogin flag, market codes, and locales. Defaults to
-- {} so existing rows don't need backfill.

ALTER TABLE "bundles"
    ADD COLUMN "eligibility" JSONB NOT NULL DEFAULT '{}'::jsonb;
