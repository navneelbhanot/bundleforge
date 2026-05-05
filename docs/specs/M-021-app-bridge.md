# M-021 — App Bridge token verification

## Goal

Mount `shopify.validateAuthenticatedSession()` on the API surface so
embedded admin requests carrying an App Bridge session token populate
`res.locals.shopify.session`. M-019's `requireShopSession` consumes that.

## Why

App Bridge tokens are how the Polaris frontend (M-094+) talks to our
backend. Without this middleware, the only way to authenticate is the
OAuth cookie session, which doesn't survive cross-origin frame loads.

## Out of scope

- Frontend App Bridge initialization — M-094.
- Token exchange to access token (offline). The SDK handles it.

## Design

```ts
// in src/server/index.ts
app.use("/api/v1", shopify.validateAuthenticatedSession());
app.use("/api/v1", requireShopSession()); // already loads Shop row
```

No new file needed; the SDK provides everything. M-021 is a wiring
milestone with documentation and a smoke test.

## Acceptance criteria

- [ ] `validateAuthenticatedSession()` mounted before `requireShopSession`.
- [ ] Existing tests still pass.
- [ ] An /api/v1/* route returns 401-ish without a token (already true
      via the rate limiter chain → eventually 401 from session middleware
      once mounted).

## Files touched

- `src/server/index.ts`
- `docs/sessions/0021-app-bridge.md`
