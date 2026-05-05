# Beta merchant onboarding (M-152)

A beta merchant should be able to install BundleForge, see populated demo
data, ship their first real bundle, and reach the storefront in
**under 30 minutes**. This document is the script we walk them through.

## Pre-flight (us, before the call)

- [ ] Confirm the merchant is on Shopify Plan **Basic or higher** (Volume
      bundle works on Basic; Bundles requiring Cart Transform are
      Plus-only).
- [ ] Add their `*.myshopify.com` domain to our beta allowlist.
- [ ] Email them the install link.
- [ ] Schedule a 30-minute Zoom for the same day.

## Step 1 — Install (≈3 min)

1. Merchant clicks the install link.
2. Reviews the requested scopes:
   - `read_products`, `write_products`
   - `read_orders`, `read_fulfillments`
   - `read_customers` *(only used for locale; no PII stored)*
   - `read_inventory`, `write_inventory`
   - `read_themes`, `write_themes` *(for the theme-extension block)*
   - `read_locales`
3. Approves; lands on the BundleForge admin home with the
   `OnboardingWizard`.

## Step 2 — Demo data (≈30 sec)

The wizard offers two paths:

- **"Skip — show me with sample data"** → seeds 8 demo bundles, 6
  orders, and audit-log rows scoped to *their* shop. The merchant can
  click around the analytics page, A/B page, and inventory page
  immediately.
- **"Start from scratch"** → goes to the bundle-creation flow.

Recommended: start with demo data. Real bundles next.

## Step 3 — First real bundle (≈10 min)

Walk them through the bundle wizard:

1. **Type**: Fixed for their first bundle (simplest). We'll explore
   mix_match and volume on the next call.
2. **Items**: pick 2-4 of their existing products via the
   ProductPicker.
3. **Pricing**: a single 10% off rule.
4. **Display**: keep defaults.
5. Save → bundle status `draft`.

## Step 4 — Theme block (≈5 min)

1. From the bundle detail page, click **"Add to theme"**.
2. Theme editor opens with the `bundleforge-bundle` block selected.
3. Drag onto the product page template; preview.
4. Save the theme.

## Step 5 — Test order (≈5 min)

1. From the merchant's storefront, add the bundle to cart.
2. Check the price reflects the 10% discount.
3. Place a test order using a Bogus Gateway / draft order.
4. Confirm the order shows up in the BundleForge admin's Orders page
   with correct attribution and SKU breakdown.

## Step 6 — Activate (≈30 sec)

1. Flip the bundle from `draft` to `active`.
2. Confirm the storefront block now shows live pricing.

## Common issues

| Symptom | Cause | Fix |
| --- | --- | --- |
| Block doesn't render in theme editor | Theme version <2024 (Online Store 2.0 required) | Upgrade or pick a different template |
| Storefront price doesn't discount | Cart Transform disabled (Plus-only flow on non-Plus) | Use the Volume rule type instead — works on every plan |
| Inventory shows "drift" | First sync after install hasn't completed | Wait 60s; trigger manual sync via `Inventory → Resync` |
| 401 from `/api/proxy/*` | App Proxy not enabled in Partners | Enable App Proxy with subpath `apps/bundleforge` |
| Theme block crashes with "fetch failed" | Storefront ad-blocker | Add the App Proxy domain to the allowlist |

## Follow-up call (D+7)

- Collect feedback on: wizard friction, bundle types tried, analytics
  usability, support channel preference.
- File any blockers as `docs/sessions/` items pre-launch.

## Beta SLA

- Email response within 4 business hours.
- Critical issues (storefront broken, orders not processing): 1 hour.
- Beta is free until launch + 30 days; paid plans optional during beta.
