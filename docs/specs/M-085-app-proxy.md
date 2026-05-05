# M-085 — App Proxy bundle config endpoint

## Goal

`/api/proxy/bundle/:slug` returns a public, signed-request-validated
JSON payload describing a bundle's items + display settings. Theme
App Extension blocks (M-088+) call this from the storefront via the
Shopify App Proxy URL configured in `shopify.app.toml`.

## Why

Storefront JS cannot read DB rows directly. App Proxy is the standard
pattern: the storefront hits `/apps/bundleforge/bundle/<slug>` →
Shopify forwards to our `/api/proxy/...` with a signed query string
containing the shop domain.

## HMAC validation

Shopify signs the query with `shop`, `path_prefix`, `timestamp` and a
`signature` parameter. We verify the signature using
`SHOPIFY_API_SECRET` (HMAC-SHA256 of the sorted other params, hex
encoded).

## Acceptance

- [ ] `verifyAppProxySignature(query, secret)` is a pure function.
- [ ] Tests: valid signature accepted; tampered signature rejected;
      missing signature rejected.
- [ ] Route `GET /api/proxy/bundle/:slug` returns 401 on bad signature.
- [ ] Route returns 404 when bundle is missing or in another shop.
- [ ] Route returns `{slug, type, items[], displaySettings}` on success.

## Files

- `src/middleware/appProxy.ts` — `verifyAppProxySignature` + middleware.
- `src/middleware/appProxy.test.ts`
- `src/routes/proxy.ts` — `/api/proxy/bundle/:slug` route.
- `src/routes/proxy.test.ts`
- `src/server/index.ts` — mount.
