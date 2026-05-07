# Bundle types

MintBundle supports 13 bundle types. Each maps to a specific buying
behavior; pick the one that matches what you want the customer to do.

> **Tip:** start with **Fixed** or **Mix & match** if you're new.
> Most stores never need more than those two.

| Type | Customer experience | Pick when |
|---|---|---|
| **Fixed** | "Buy this 3-product set" | You want a curated bundle at one price |
| **Mix & match** | "Pick any 3 from this list of 8" | Customer-driven choice, fixed total quantity |
| **BOGO** | "Buy 1, get 1 free" | Classic promo, single qualifier → reward |
| **Buy X get Y** | "Buy 2 shirts, get a hat for $5" | Cross-sell tied to a qualifying purchase |
| **Volume** | "5% off 3+, 10% off 6+" | Tiered discount on the same product |
| **Build a box** | "Choose 1 entree, 2 sides, 1 drink" | Guided multi-category selection |
| **Multipack** | "12-pack" | Same SKU, fixed multiplier, discounted unit price |
| **Gift** | "Free gift with $50+ order" | Threshold-based promotional add-on |
| **Mystery** | "Surprise box, $35" | Curated rotating contents |
| **Sample** | "Try-before-you-buy" trial set | Onboarding new customers |
| **Subscription** | "Monthly bundle, 15% off" | Recurring with bundle pricing |
| **Wholesale** | "Tiered B2B pricing on quantity" | B2B / quantity-priced |
| **Custom** | Anything not above | Escape hatch with explicit JSON config |

---

## Fixed

A static set of components at a flat price.

**Configure:**
- Add the component products / variants to **Items**.
- Add a single **Fixed** pricing rule with the bundle price (e.g. $79
  for $99 of contents).
- Optionally set quantity per item (defaults to 1).

**Customer flow:** sees one "Add to cart" button; gets all components
on order.

**Inventory:** decrements each component by `quantity × bundles
ordered` atomically.

## Mix & match

Customer picks N items from a list of M.

**Configure:**
- Add the eligible products to **Items**.
- In the bundle's **Config**, set `pickCount` (e.g. 3).
- Optionally set per-item `minQuantity` / `maxQuantity` to constrain
  the choice.
- Pricing rule: typically **Fixed** ("any 3 for $25") or **Percentage**
  ("any 3, 20% off").

**Customer flow:** the [mix-and-match grid](storefront.md#blocks)
theme block renders a checkbox grid; customer picks 3, hits Add to
cart.

## BOGO

Buy one, get one (free or discounted).

**Configure:**
- Add the qualifier item(s) and the reward item(s).
- Pricing rule type **BOGO**:
  - `qualifierQuantity` (default 1)
  - `rewardQuantity` (default 1)
  - `rewardDiscount` (`100` for free, `50` for half off, etc.)

**Customer flow:** add 2 to cart, second one's discount applies in
both the cart and at checkout (Cart Transform parity).

## Buy X get Y (BxGy)

Like BOGO but the qualifier and reward are different products.

**Configure:** same as BOGO but qualifier ≠ reward. Often used as
"Buy a coffee maker, get filters at 50% off."

## Volume

Tiered discounts based on cart quantity of the bundle (or a specific
component).

**Configure:**
- Pricing rule type **Volume** with tier rows:
  ```
  3-5 items → 5% off
  6-11 items → 10% off
  12+ items → 15% off
  ```

## Build a box

Guided, multi-category selection (e.g. meal kits).

**Configure:**
- Group items via the `groupName` field on each item (e.g.
  `"entree"`, `"side"`, `"drink"`).
- In **Config**, set per-group `pickCount`.
- Pricing rule: usually **Fixed** ("$45/box").

**Customer flow:** the [build-box-stepper](storefront.md#blocks)
walks the customer through each group.

## Multipack

A multiplier of one SKU at a discounted unit price.

**Configure:**
- One item; quantity = pack size (e.g. 12).
- Pricing rule: **Fixed** or **Percentage**.

## Gift

Free add-on triggered by a cart-value threshold.

**Configure:**
- Add the gift product to **Items** with `isDefault: true`.
- Pricing rule type **BOGO** with `rewardDiscount: 100` and a
  `minCartValue` condition.

## Mystery

Curated bundle whose specific contents rotate.

**Configure:** same shape as Fixed; you control which items are in it
and rotate them when you want.

## Sample

Try-before-you-buy. Often a near-cost or free trial set.

**Configure:** Fixed bundle, low/zero pricing rule. Sometimes paired
with a per-customer order limit (configure in your Shopify admin's
discount rules).

## Subscription

Bundle priced for recurring delivery. Requires a Shopify subscription
adapter (ReCharge / Bold are pre-wired — see
[storefront.md](storefront.md#subscriptions)).

**Configure:**
- Items + pricing rule as usual.
- In **Config**, `subscriptionFrequency` (e.g. `"30d"`).

## Wholesale

Quantity-tiered B2B pricing. Often gated by Shopify customer tag.

**Configure:**
- Pricing rule type **Tiered** with case-pack tiers.
- Optional condition: `customerTag: "wholesale"`.

## Custom

Escape hatch. The **Config** field is opaque JSON; the pricing engine
can be extended with a custom rule type. Use only if the 12 above
genuinely don't fit — most "custom" cases are actually one of the
above with creative configuration.

---

**Next:** [Pricing rules](pricing.md) — how the discount math works.
