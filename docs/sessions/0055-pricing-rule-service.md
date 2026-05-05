# Session 0055 — PricingRule service

`src/services/bundles/pricingRuleService.ts`: tenant-safe add/update/
remove for individual pricing rules. Validates rule type allowlist. DI
via `PricingRuleRepo` interface. 5 unit tests. 257 tests pass total.
