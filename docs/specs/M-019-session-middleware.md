# M-019 — Session middleware (requireShopSession)

## Goal

Provide a single middleware that every authenticated `/api/v1/*` route
uses to load the current `Shop` and attach it to the Express request.

## Why

Centralizes shop scoping. Repositories then trust `req.shopId` and
never re-derive it from headers or query strings.

## Out of scope

- Session token verification at the SDK level — handled by
  `shopify.validateAuthenticatedSession()` from M-021.
- Plan resolution — M-031 will read `req.shop.planName`.

## Design

```ts
// src/middleware/shopSession.ts
export function loadShopByDomain(client, domain): Promise<Shop | null>;
export function requireShopSession(opts?: {
  loadShop?: typeof loadShopByDomain
}): RequestHandler;
```

The middleware reads the validated session (`res.locals.shopify.session`,
set by upstream `shopify.validateAuthenticatedSession()` middleware)
or, as a fallback for webhook routes, the `x-shopify-shop-domain`
header. If neither is present → `UnauthorizedError`. If the Shop row
is not found or has `uninstalledAt` set → `UnauthorizedError`.

Successful path:
- `req.shopDomain = shop.shopifyDomain;`
- `req.shopId = shop.id;`

`req.shop` is intentionally NOT populated to keep the surface tiny;
routes that need full shop fields can query themselves.

## Acceptance criteria

- [ ] Typecheck + tests green.
- [ ] Tests:
  - [ ] Happy path (session in res.locals): loads shop, attaches
        shopId/shopDomain, calls next().
  - [ ] Missing session AND missing header: 401 via UnauthorizedError.
  - [ ] Shop not found: 401.
  - [ ] Shop with `uninstalledAt` set: 401.
  - [ ] DI of loadShop: tests use a fake.

## Files touched

- `src/types/express.d.ts` (add shopId, shopDomain optional)
- `src/middleware/shopSession.ts` (new)
- `src/middleware/shopSession.test.ts` (new)
