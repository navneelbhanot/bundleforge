# M-086 — Checkout Guardian (cart-level validator)

## Goal

`POST /api/proxy/validate-cart` accepts a cart payload from the
storefront block and asserts the bundle is structurally valid before
the customer reaches checkout.

## Validation rules (per bundle type)

- `mix_match`, `build_box`: total selected items between
  `config.minItems` and `config.maxItems`; `allowDuplicates` honored
  when present; for build_box, each `step.pickCount` is met.
- `multipack`: total quantity equals `config.packQuantity`.
- Other types: at least one line.

Returns `{ valid: true }` or `{ valid: false, errors: [...] }`.

## Files

- `src/services/bundles/validateCart.ts` — pure function.
- `src/services/bundles/validateCart.test.ts`
- `src/routes/proxy.ts` — add `POST /validate-cart`.
- `src/routes/proxy.test.ts` — add cases.
