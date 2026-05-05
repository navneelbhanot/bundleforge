# Session 0087 — Checkout Validation Function (Plus only)

`extensions/checkout-validation/` ships a `purchase.validation.run`
Function that BLOCKS checkout (vs Cart Transform which only adjusts
pricing). For non-Plus stores it isn't deployed; the Checkout
Guardian (M-086 `/api/proxy/validate-cart`) provides the equivalent
pre-checkout signal in the storefront block. 4 unit tests against the
JS module.

349 tests pass.
