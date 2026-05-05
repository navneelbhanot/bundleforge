# Sessions 0085..0086 — App Proxy + Checkout Guardian

- `src/middleware/appProxy.ts` (M-085) — `verifyAppProxySignature`
  pure helper + `appProxyAuth` middleware. Uses `timingSafeEqual`.
- `src/routes/proxy.ts` (M-085, M-086) — `GET /bundle/:slug` returns
  the published bundle JSON; `POST /validate-cart` calls the pure
  `validateCart` helper and returns `{valid, errors[]}`.
- `src/services/bundles/validateCart.ts` (M-086) — per-type
  validation: mix_match/build_box min/max + duplicates + step
  pickCount; multipack exact packQuantity.
- 5 + 4 + 6 tests (signature, route, validator).

345 tests pass.
