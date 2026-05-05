# Session 0050 — BundleService.duplicate

Added `duplicate(shopId, id)` to `BundleService`. Reads the source bundle
with items + pricing rules, normalizes the shape, then calls `create`
with title `"<original> (Copy)"`. Decimal fields are converted to numbers
via `.toString()`. 1 unit test.
