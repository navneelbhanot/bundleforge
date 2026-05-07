# Pricing rules

How MintBundle computes the price your customer sees and pays.

## How it works (one paragraph)

When a customer adds a bundle to cart, MintBundle runs **the same
pricing engine** in two places:

1. **Server-side** for admin previews, order processing, and analytics.
2. **Inside Shopify's Cart Transform Function** for the live cart and
   checkout.

Both call the same pure function with the same inputs and produce the
same number to the cent. There's a parity test that runs on every
commit comparing both runtimes against shared fixtures. **If the cart
and checkout ever disagree, the test would have failed first** —
which means you can trust what the customer sees.

## Rule types

| Type | What it does |
|---|---|
| **Fixed** | Sets the bundle to a flat price (e.g. `$79`) |
| **Percentage** | Discounts the component sum by N% (e.g. `15%`) |
| **Flat discount** | Subtracts a fixed amount (e.g. `$10 off`) |
| **Tiered** | Different price brackets based on a condition |
| **Volume** | Quantity-based discount tiers |
| **BOGO** | Discount on a "reward" item triggered by a "qualifier" |
| **Custom** | Opaque hook for app-specific math (rare) |

## A bundle can have multiple rules

Add as many as you want; they evaluate in **priority order** (lower
number = higher priority).

```
Priority 1: Fixed     ($79)
Priority 2: BOGO      (free 4th item)
Priority 3: Percentage (extra 5% off if customer is in "vip" tag)
```

## Stacking

By default, rules **don't stack** — the first rule whose conditions
match applies, and evaluation stops.

To allow stacking, set `isStackable: true` on each rule that should
cumulate. Stackable rules apply in priority order, each operating on
the result of the previous.

> **Be careful with stackable Percentage + Fixed.** A 20% rule
> stacked on a `$10 off` rule produces a different result than a
> `$10 off` stacked on a 20% rule. Test the combination on a draft
> bundle before publishing.

## Conditions

Every rule supports optional conditions:

| Condition | Example |
|---|---|
| `minQuantity` | Apply only if N+ items in the bundle |
| `maxQuantity` | Apply only if up to N items |
| `minCartValue` | Apply only if cart total ≥ $X |
| `customerTag` | Apply only to customers with a Shopify tag |
| `dateRange` | Apply between `startsAt` and `endsAt` |

Multiple conditions on the same rule are AND'd.

## Examples

### "20% off, but only on orders over $50"
- Type: **Percentage**, value `20`
- Condition: `minCartValue: 50`

### "Tiered: 5% / 10% / 15% off at 3, 6, 12 items"
- Type: **Volume** with three tiers:
  ```
  { minQuantity: 3, value: 5 }
  { minQuantity: 6, value: 10 }
  { minQuantity: 12, value: 15 }
  ```

### "Free 4th item, capped at one free item per order"
- Type: **BOGO**
- `qualifierQuantity: 3`
- `rewardQuantity: 1`
- `rewardDiscount: 100`
- `maxQuantity: 4` (so 7-in-cart doesn't give 2 frees)

## Verifying

Three places to verify a bundle prices correctly:

1. **Admin preview** — the bundle detail page in MintBundle.
2. **Live cart on storefront** — what the customer sees.
3. **Shopify checkout total**.

All three should match exactly. If they don't, see
[Troubleshooting → Cart and checkout disagree](troubleshooting.md#cart-and-checkout-show-different-totals).

---

**Next:** [Inventory](inventory.md) — how bundle sales decrement stock.
