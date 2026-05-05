# M-018 — OAuth callback + token persistence

## Goal

Mount the OAuth callback route. After Shopify exchanges the auth code
for an access token, upsert the `Shop` row with the encrypted token
(via M-002 utility) and let the SDK redirect into the embedded admin.

## Why

This is what makes "install" actually persist anything in our DB. Every
later milestone that needs `Shop` assumes this row exists.

## Out of scope

- Async post-install bootstrap jobs (e.g., webhook subscription sync).
  Add when needed; not blocking.
- App Bridge token middleware: M-021.
- Persistent session storage adapter: M-020.

## Design

```ts
// src/shopify/install.ts
export async function persistShop(
  session: { shop: string; accessToken: string; scope?: string },
  shopifyShopGid?: string,
): Promise<{ id: string }>;

// in src/server/index.ts:
app.get(
  shopify.config.auth.callbackPath,
  shopify.auth.callback(),
  afterAuth(),                         // <-- our middleware
  shopify.redirectToShopifyOrAppRoot(),
);
```

`afterAuth()` reads `res.locals.shopify.session` (set by the SDK),
calls `persistShop()`, and continues. On error it surfaces via the
M-007 error handler (no silent failures during install).

Persistence rules:
- `accessToken` is encrypted with `encrypt()` (M-002) before write.
- `shopifyDomain` = `session.shop`.
- Other Shop fields (name, email, currency, etc.) are best-effort
  fetched in a follow-up milestone via the GraphQL client (M-022). For
  M-018, default to `name = session.shop` and `email = ""` so the row
  satisfies NOT NULL constraints. M-027 (`shop/update` webhook) will
  reconcile.

## Acceptance criteria

- [ ] `persistShop()` is a pure function that takes a session-like object
      and a Prisma-like client; tests inject a fake.
- [ ] `persistShop()` encrypts the access token with the M-002 helper.
- [ ] On second call with the same shop, it updates rather than
      duplicates (upsert).
- [ ] Server mounts the callback chain (no live integration test).
- [ ] Boot phase remains green.

## Files touched

- `src/shopify/install.ts` (new)
- `src/shopify/install.test.ts` (new)
- `src/server/index.ts` (mount callback chain)
