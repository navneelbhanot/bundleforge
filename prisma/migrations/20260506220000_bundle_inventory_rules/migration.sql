-- M-173: Per-bundle inventory rules.
--
-- Mirrors the shop-level Inventory settings from M-163 but lets
-- a single bundle override individual keys, plus adds two
-- bundle-specific rules (pauseWhenComponentBelow,
-- componentOnlyMode). Defaults to '{}' so every existing bundle
-- inherits the shop-level config until the merchant overrides.
ALTER TABLE "bundles"
    ADD COLUMN "inventory_rules" JSONB NOT NULL DEFAULT '{}'::jsonb;
