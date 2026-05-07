# FAQ

Plain answers to the questions merchants ask most.

## Pricing & billing

### What does it cost?

Four plans:

- **Starter** — Free. 5 bundles, 100 bundle orders/month, every
  feature except 3PL/WMS sync, A/B testing, and white-labeling.
- **Growth** — $12/month. Unlimited bundles + orders. Adds inventory
  audit dashboards, AI suggestions, POS (1 location).
- **Pro** — $35/month. Everything in Growth + 3PL/WMS sync, A/B
  testing, Shopify Flow, custom metafields.
- **Enterprise** — $129/month. Everything in Pro + Hydrogen/headless,
  dedicated worker queue, 24/7 support, white-label option.

Annual billing is **20% off** all paid tiers. Same feature set; just
billed once a year.

### Will my bill go up if my store grows?

No. Pricing is **flat-rate**, not usage-based. Going from 100 orders
to 100,000 orders on the same plan doesn't change your bill. (We
think usage caps are a tax on growth — see our positioning vs.
Kaching, BOGOS, Fast Bundle.)

### Is there a free trial?

Paid plans include a 14-day trial by default. You can cancel during
the trial without being charged.

### Can I migrate from another bundle app?

Yes — MintBundle ships importers for Simple Bundles, Bundler,
Kaching, and Shopify Bundles. From Settings → Migrations, paste a
CSV export from your old app and MintBundle maps it to native
bundles.

## Inventory & orders

### Does MintBundle support multi-location inventory?

Yes. Each bundle's components can come from any location Shopify
exposes. The Inventory Health page shows per-location breakdowns.

### What happens if a component runs out of stock mid-checkout?

The Cart Transform Function and the Checkout Validation Function
both pre-validate bundle composition before payment. If a component
goes out of stock between cart and checkout, the customer sees a
clear "Out of stock" message before payment. **No customer pays for
a bundle whose components have already sold out.**

### What's the audit log for?

Every inventory adjustment writes a row to `inventory_audit_log`
that **cannot be updated or deleted** (enforced by a Postgres
BEFORE-UPDATE trigger). This means:

- Returns and exchanges have a permanent paper trail.
- Customer disputes can be answered with timestamped evidence.
- 3PL reconciliation has a single source of truth.

If you've ever had a bundle app's inventory drift from reality
silently, you'll know why this is the headline feature.

### Does refunding an order auto-restock the components?

Yes — the `refunds/create` Shopify webhook triggers a per-component
inventory increment, audit-logged with `reason: 'refund'` and a
foreign key to the original order.

## Storefront

### Will my customers see "MintBundle" anywhere?

No. The bundle is a normal Shopify product; the storefront branding
is your theme's. The cart label, checkout, and order confirmation all
say what *you* configure them to say.

### Does it work with my theme?

Online Store 2.0 themes (Dawn, Ride, Sense, Studio, Refresh, etc.)
work out of the box — drop in the theme app block, no code edits.

Vintage themes need a one-time Liquid include (`{% include
'mintbundle-bundle' %}`); MintBundle's onboarding wizard offers to
add it for you during install.

### What about a headless / Hydrogen storefront?

Hydrogen / Storefront API support is on the roadmap (see
`PRODUCT_PLAN.md` §4). The bundle pricing engine is already
runtime-agnostic — same code on the server and inside Shopify
Functions — so the work is plumbing, not core logic.

### Does it work with subscriptions?

Yes, with **ReCharge** and **Bold Subscriptions** out of the box.
Native Shopify Subscriptions are one adapter away — see the
integrations directory.

## Privacy & compliance

### Is MintBundle GDPR-compliant?

Yes. The three mandatory Shopify GDPR webhooks (`customers/data_request`,
`customers/redact`, `shop/redact`) are wired up. There's also an
admin-initiated GDPR data export (`POST /api/v1/gdpr/export`) and
a shop deletion endpoint that cascades cleanly.

### What data does MintBundle store?

- **Shop data**: domain, name, email, plan, encrypted access token.
- **Bundles**: titles, types, items, pricing rules, configs.
- **Orders**: bundle composition per order — required for fulfillment
  and inventory reconciliation.
- **Inventory adjustments**: append-only audit log per SKU.
- **Sessions**: short-lived OAuth state.

Personal customer information beyond Shopify's own customer-id
references is **not** stored.

### Are access tokens encrypted at rest?

Yes — AES-256-GCM with the `ENCRYPTION_KEY` environment variable.
Database snapshots are useless without the key.

## Support

### How do I get help?

Today: email the address in your App Store listing. Live chat is on
the roadmap and will be wired into the embedded admin once the
support tooling is finalized.

### Where are the technical docs?

- [`docs/openapi.yaml`](../openapi.yaml) — full `/api/v1/*` schema.
- [`docs/runbook.md`](../runbook.md) — local dev + deploy procedures.
- [`docs/runbook-incidents.md`](../runbook-incidents.md) — incident
  response.
- ADRs in [`docs/decisions/`](../decisions/) for cross-cutting
  architecture decisions.
