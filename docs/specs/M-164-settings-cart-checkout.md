# M-164 — Settings · Cart & Checkout tab

> Fourth milestone of Phase R1 (`docs/plans/rich-admin-ui-roadmap.md`).
> Surfaces the cart/checkout-time options merchants ask about most:
> which Cart Transform path runs, what happens when checkout
> validation fails, and what the storefront does to in-progress
> selections when the customer leaves and comes back.

---

## Why

The 2026-05-06 commit landed metafield-driven Cart Transform
expansion (`extensions/cart-transform/src/run.js` reads
`bundleforge.is_bundle` + `bundleforge.components` and emits
`expand` operations). Today every merchant gets that path by
default — there's no way to opt back into the older
attribute-driven path even though it's still in the runtime. This
tab exposes that choice as a per-shop default.

Atomic checkout enforcement and abandonment behavior are the other
two cart-time levers competitors expose (Kaching, BOGOS, and Simple
Bundles all surface at least one).

This is the first R-phase milestone where a setting **does**
already affect runtime behavior — Cart Transform's mode toggle is
read by the existing function. The other two settings persist now;
their consumers (Checkout Validation extension behavior, theme
block selection-restore logic) will read them in follow-on tickets.

---

## Scope

### Server

Extend `PatchSchema` in `src/routes/settings.ts` with a `cart`
subobject:

```ts
cart: z.object({
  defaultMode: z.enum([
    "bundle_as_product",
    "components_as_attributes",
  ]).optional(),
  atomicCheckoutEnforcement: z.enum([
    "strict", "warn", "off",
  ]).optional(),
  abandonmentBehavior: z.enum([
    "keep_selections", "clear_selections", "prompt_user",
  ]).optional(),
  cartNoteTemplate: z.string().max(280).optional(),
}).strict()
```

GET response gains `cart` raw subobject (no fallbacks server-side).
PUT uses the existing `mergeSubobject` helper.

### Cart Transform Function — read the mode

`extensions/cart-transform/src/run.js` currently always runs both
paths (expand for metafield-flagged products, update for
attribute-flagged lines). Update the function to:

1. Read a new optional input metafield `cart.defaultMode` from
   the shop's setting metafield (Cart Transform Functions can read
   `cart` metafields via the shop attribute, but here the simplest
   path is per-product: each bundle product already carries
   `bundleforge.components`. We use a new shop-scoped metafield
   `bundleforge.cart_default_mode` set when the merchant saves
   this setting, fetched as a shop metafield in the GraphQL).
2. If `defaultMode === "components_as_attributes"`, skip the
   expand path entirely (only run update).
3. If `defaultMode === "bundle_as_product"` (default), keep
   today's behavior (both paths).

To keep this milestone tight, the Cart Transform Function update
ships **but the shop metafield write** is deferred to a small
follow-on (M-164b) — without the metafield the function falls
back to today's behavior, so this is a no-regression change. The
spec for M-164b is one-shot: when the merchant saves
`cart.defaultMode` in the admin, also write
`bundleforge.cart_default_mode` to the shop via Admin GraphQL
`shopSettingsMutation` or `metafieldsSet` for the shop owner ID.

For this milestone the Cart Transform code change is *just*
"read the optional metafield, branch on it" — no breaking change
to existing tests.

### Client

In `frontend/src/pages/SettingsPage.tsx`:

- Flip the Cart & Checkout TabSpec from `"deferred"` to `"ready"`.
- Two cards.

**Cart mode card:**
- `Select` for `defaultMode` with two options:
  - `bundle_as_product` — "Sell as a single product line that
    expands at cart time (recommended)"
  - `components_as_attributes` — "Add component lines directly to
    cart with bundle attributes"
- Banner explaining the trade-off: bundle_as_product needs the
  cart-transform metafield write (M-164b for full effect),
  components_as_attributes works today on every storefront block.

**Checkout protections card:**
- `Select` for `atomicCheckoutEnforcement`:
  - `strict` — "Reject the checkout if any component goes OOS
    between cart and payment"
  - `warn` — "Allow checkout, surface a warning"
  - `off` — "Allow checkout, no warning"
- `Select` for `abandonmentBehavior`:
  - `keep_selections` — "Restore the bundle selections when the
    customer returns"
  - `clear_selections` — "Empty the bundle selection on return"
  - `prompt_user` — "Ask the customer what to do"
- `TextField` for `cartNoteTemplate` — multiline=3, max 280 chars,
  helpText explaining `{bundle_title}` and `{components_count}`
  placeholders. Inserts a cart-line note for accounting/3PL
  visibility.

Both cards use the existing `CardSaveBar` per-card pattern with
`patchSubobject("cart", patch)`.

### Tests

- `src/routes/settings.test.ts` (extend):
  - PUT a full cart patch → round-trips.
  - PUT cart.defaultMode = "weird" → 400.
  - PUT cartNoteTemplate > 280 chars → 400.
  - Deep-merge: PUT cart.defaultMode doesn't drop a previously
    saved cart.atomicCheckoutEnforcement.

- `frontend/src/pages/SettingsPage.test.tsx` (extend):
  - Cart & Checkout tab no longer placeholder; renders both card
    headings.
  - Saving the Cart mode Select sends `{ cart: { defaultMode: ... } }`.

- `extensions/cart-transform/src/run.test.ts` (extend):
  - When the synthesized "shop metafield" input has
    defaultMode = "components_as_attributes", the function does
    NOT emit an expand op for a bundle product.
  - When the metafield is absent (today's runtime), behavior is
    unchanged from the existing 8 tests.

---

## Acceptance criteria

- [x] Compiles, lints, all vitest pass.
- [x] /settings#cart renders two cards.
- [x] PUT round-trips every cart field.
- [x] Cart Transform run.js correctly branches on the optional
  metafield without breaking the 8 existing tests.

---

## Out of scope (deferred)

- **M-164b** — actually writing the
  `bundleforge.cart_default_mode` shop metafield from the admin
  Save action. Until then `cart.defaultMode` persists in
  `settings.cart` and the merchant sees their selection, but the
  Cart Transform Function does not yet read it (no regression —
  it stays on the default branch).
- Storefront block consumption of `abandonmentBehavior` and
  `atomicCheckoutEnforcement` warning UI — separate theme/checkout
  extension work.
- `cartNoteTemplate` actually written into cart-line notes —
  hooks into the bundle-add-to-cart path on the storefront, separate.

These follow the "ship the option, wire the behaviour later"
pattern established by M-161..M-163.
