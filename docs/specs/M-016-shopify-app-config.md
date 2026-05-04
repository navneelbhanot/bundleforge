# M-016 — Shopify CLI app config validation

## Goal

Review `shopify.app.toml` for correctness, align scopes with
`.env.example`, and document what the user must provide before M-017
(OAuth install route) can run end-to-end.

## Why

Mismatched scopes between the TOML and runtime config silently break
things later. Better to lock down now.

## Out of scope

- Acquiring a real `client_id` from Shopify Partner Dashboard. That's a
  user action.
- Wiring `@shopify/shopify-app-express`. M-017+.

## Acceptance criteria

- [ ] `shopify.app.toml` `[access_scopes].scopes` matches the value in
      `.env.example` `SHOPIFY_SCOPES`.
- [ ] `[auth].redirect_urls` and `[app_proxy].url` use placeholders the
      user can fill in (do not commit a real URL).
- [ ] `[webhooks].api_version` is at the latest stable as of the cutoff
      date (or noted that it must be reviewed when the user provisions).
- [ ] Both compliance and privacy webhook subscriptions are present.
- [ ] User instructions are added to the runbook.

## Files touched

- `shopify.app.toml` (review only or one-line scope alignment).
- `docs/runbook.md` (Shopify Partner App setup section).

## What the user must do

1. Create a Shopify Partner app at https://partners.shopify.com.
2. Generate API credentials and put them in `.env`:
   - `SHOPIFY_API_KEY`
   - `SHOPIFY_API_SECRET`
3. Update `client_id` in `shopify.app.toml` to the partner app id.
4. Set the public app URL (tunneling locally with `shopify app dev`,
   or a real domain in production) and update `[auth].redirect_urls`
   and `[app_proxy].url`.
