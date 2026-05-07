# Storefront integration

How bundles render on your store's public pages.

## The integration model

MintBundle ships as a **Theme App Extension** — a set of drop-in
blocks for Online Store 2.0 themes (Dawn, Ride, Sense, Studio, etc.).
**No Liquid edits are required** for OS 2.0 themes; the blocks appear
in your theme editor's Add block dropdown.

For older "Vintage" themes, see [below](#vintage-themes).

## Blocks

| Block | Use for | What it renders |
|---|---|---|
| **Bundle display** | Universal — works for any bundle type | Bundle title, image, price, "Add to cart" |
| **Mix-and-match grid** | `mix_match`, `build_box` | Checkbox grid of choices with running total |
| **BOGO display** | `bogo`, `bxgy` | "Buy X, get Y" callout with auto-add reward |
| **Build-a-box stepper** | `build_box` (multi-category) | Multi-step picker by `groupName` |
| **Variant selector** | Variant-aware bundles | Per-component size/color picker |

## Adding a block

1. Online store → Themes → **Customize** on the active theme.
2. Open the page where you want the bundle (Product, Collection,
   Home, custom).
3. **Add block** → "MintBundle" section → pick the matching block.
4. In the block settings:
   - Pick the bundle by title.
   - Choose layout options (columns, image style, button copy).
5. **Save** the theme.

The block is now live; visit your storefront to verify.

## Where do bundles live in Shopify?

A published bundle creates a real Shopify product. That gives you:

- **Standard product URL**: `/products/<bundle-slug>`. Linkable from
  email, ads, navigation, anywhere.
- **Collection eligibility**: bundle products show up in collections
  matching their tags.
- **Search and filter**: works the same as any product.
- **Reporting**: Shopify's native sales reports show the bundle as a
  line item.

The bundle product carries an `is_bundle` metafield so themes can
treat it specially if you want.

## Cart and checkout

When a customer adds a bundle to cart, two things happen:

1. **Live cart** runs the same pricing engine the admin runs (the
   bundle line shows the right discount immediately).
2. **Checkout** runs Shopify's Cart Transform Function — also calling
   the same pricing engine — so the discount is preserved.

Cart and checkout always agree to the cent because both calls use the
same shared code path.

## App Proxy

Some advanced theme integrations need to query bundle data directly
from Liquid. The App Proxy is mounted at:

```
https://<your-store>.myshopify.com/apps/mintbundle/<path>
```

Routes available under the proxy (HMAC-verified by Shopify):

```
POST /apps/mintbundle/bundles/<slug>/price
```

Use this to compute a price for a specific item-quantity composition
without an actual cart.

The proxy's authoritative URL is `/api/proxy` on the MintBundle
server; Shopify forwards requests with a signed `signature` query
that MintBundle verifies before responding.

## Subscriptions

Subscription bundles work with two adapters out of the box:

- **ReCharge** — set the bundle's `subscriptionFrequency` and tag the
  product `recharge_eligible`.
- **Bold Subscriptions** — same pattern with `bold_subscription`.

For Shopify's native Subscriptions API, the integration is one HTTP
call away — see `src/services/integrations/` for the adapter pattern.

## Vintage themes

For themes that aren't OS 2.0 (no Theme App Extension support), drop
this snippet into the page template where you want the bundle:

```liquid
{% include 'mintbundle-bundle' with id: 'your-bundle-slug' %}
```

This requires a one-time `mintbundle-bundle.liquid` snippet to be
copied into your theme. MintBundle's onboarding wizard will offer
this for legacy themes during install.

## Multi-language storefronts

The theme blocks render in your store's locale automatically. Six
locales ship with the extension: `en`, `es`, `fr`, `de`, `it`, `pt`.
Localized strings live in `extensions/theme-extension/locales/`.

To add a locale:
1. Copy `en.json` to `<locale>.json`.
2. Translate the strings.
3. The extension's manifest auto-discovers locale files.

---

**Next:** [Troubleshooting](troubleshooting.md) — what to do when
something doesn't render or doesn't add up.
