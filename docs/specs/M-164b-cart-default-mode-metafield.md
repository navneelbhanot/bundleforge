# M-164b — Cart default mode shop metafield

> Behavior wiring for M-164. The Cart & Checkout tab
> persists `settings.cart.defaultMode`; the Cart Transform
> Function already reads `bundleforge.cart_default_mode`
> shop metafield. M-164b plumbs the admin save action
> through to that metafield so the CTF actually sees the
> merchant's choice.

---

## Why

M-164's spec called out the metafield write as a deferred
b sub-milestone — the CTF was wired to read the metafield
optimistically, but nothing wrote it. As a result, every
shop falls into the default `bundle_as_product` mode
regardless of admin choice.

## Scope

### Server

New helper `src/shopify/metafields.ts`:
- `writeShopMetafield(session, { namespace, key, value, type })`
  using the `metafieldsSet` GraphQL mutation.
- Single-shot, best-effort. Returns the metafield id on
  success or throws on user-error.

`src/routes/settings.ts` PUT handler:
- After persisting the merchant's cart-settings patch, if
  `patch.cart?.defaultMode` is present, call
  `writeShopMetafield(session, …)` to push the value into
  Shopify. Wrap in try/catch — a metafield-write failure
  logs at warn but doesn't block the settings save (the
  CTF will keep using the previous metafield value until
  the next save retries).

### Tests

- New `src/shopify/metafields.test.ts` (3 cases): happy
  path, GraphQL `userErrors` → throw, network error → throw.
- `src/routes/settings.test.ts` (+2 cases):
  - PUT with `cart.defaultMode` calls the metafield helper.
  - PUT without `cart.defaultMode` doesn't call it.
  - Metafield-write failure doesn't fail the settings PUT
    (still 200).

---

## Acceptance criteria

- [x] Compiles, lints clean, all vitest pass.
- [x] Saving the Cart & Checkout tab in admin updates the
  shop metafield.
- [x] Metafield-write errors don't poison the settings PUT.

## Out of scope

- Backfill on first install (the metafield doesn't exist
  yet for shops who installed before M-164b — the next
  Cart & Checkout save populates it).
- Per-locale or per-market overrides of the cart mode.
