# Getting started

This walks you from a fresh Shopify store to a published bundle on
your storefront in roughly five minutes.

## 1. Install

From the MintBundle listing on the Shopify App Store, click **Add
app** and follow the install prompts. You'll authorize the requested
scopes, then land in the embedded admin.

If you arrived from a partner-shared install link instead, the URL
will be:

```
https://app.mintbundle.app/api/auth?shop=<your-store>.myshopify.com
```

## 2. Pick a bundle type

Click **Create bundle**. You'll see two fields:

- **Title** — what merchants see in the admin. Storefront customers
  see the title set on the bundle's published product.
- **Type** — one of 13 (see [Bundle types](bundle-types.md)). Most
  merchants start with **Fixed** (a static set of products at a flat
  price) or **Mix & match** (customer chooses N of M products).

Click **Save**. You'll land on the bundle detail page with empty
**Items** and **Pricing rules** sections.

## 3. Add products to the bundle

Open the **Items** panel and pick the products that compose the
bundle. For variants with size/color options, choose the specific
variant — bundles are SKU-aware by design.

## 4. Set the price

Open **Pricing rules** and add at least one rule. The simplest
starting point is a **percentage discount** (e.g. 15% off the bundle's
component sum). For more options see [Pricing rules](pricing.md).

> **Verify it.** The pricing engine runs both server-side and inside
> Shopify's Cart Transform Function. Both produce the same number to
> the cent — there's a parity test on every commit.

## 5. Publish

Click **Publish**. MintBundle:

- Creates a Shopify product for the bundle (so it can be added to
  cart, ordered, and reported on like any product).
- Wires the Cart Transform Function so checkout matches the cart.
- Makes the bundle visible to the theme app blocks.

## 6. Add to your theme

Go to **Online store → Themes → Customize**. In the page where you
want the bundle to appear:

1. Click **Add block** (or **Add section** depending on theme).
2. Choose the block that matches your bundle type:
   - **Bundle display** — universal block; works for any type.
   - **Mix-and-match grid** — for `mix_match` / `build_box`.
   - **BOGO display** — for `bogo` / `bxgy`.
   - **Build-a-box stepper** — for guided multi-step bundles.
   - **Variant selector** — for variant-aware bundles.
3. In the block's settings, pick the bundle by title.
4. **Save** the theme.

Visit your storefront — the bundle is live.

> No Liquid edits required. If your theme is Online Store 2.0 (Dawn,
> Ride, Sense, Studio, etc.) the blocks drop in cleanly. Vintage
> themes need a 5-minute Liquid include — see
> [storefront.md](storefront.md#vintage-themes).

## 7. Watch one order through

Place a test order on the bundle (or use the demo data — see
`scripts/demo-reset.sh` if you're on a dev store). Check:

- **Cart total = Order total** to the cent.
- **Inventory** updates: each component SKU decremented by the
  bundle's quantity. Open the **Inventory → Audit** tab and you'll see
  one immutable log row per component.
- **Order details** in Shopify admin show the bundle as a line item
  *and* the components as fulfillment-ready SKUs.

That's the full loop. Anything else from here is configuration depth.

---

**Next:** [Bundle types](bundle-types.md) covers when to use each
of the 13 types with examples.
