# Session 0016 — Shopify CLI app config validation

- **Date:** 2026-05-04
- **Milestone(s):** M-016

## What was done

- Verified `shopify.app.toml`:
  - Scopes match `SHOPIFY_SCOPES` in `.env.example` (read/write
    products, orders, inventory, customers, themes, cart_transforms,
    locations, publications).
  - `[auth].redirect_urls` and `[app_proxy].url` are placeholders the
    user fills in.
  - `[webhooks].api_version = "2025-01"` (current stable per knowledge
    cutoff; user should review when provisioning).
  - Compliance topics (data_request, redact x2) and privacy
    (app/uninstalled) are subscribed.
- Added a Shopify Partner App setup section to the runbook listing the
  user actions required before M-017 can run end-to-end.

## Acceptance criteria

- [x] All spec items satisfied.
- [x] Boot phase remains green (84 tests).

## Handoff

Next: **M-017 — OAuth install route**. Wire `@shopify/shopify-app-express`,
expose `/api/auth` and `/api/auth/callback` per the Shopify CLI's
expectations, hook the Prisma session storage adapter (M-020 lands the
adapter; M-017 may stub or use the package's in-memory until then).
