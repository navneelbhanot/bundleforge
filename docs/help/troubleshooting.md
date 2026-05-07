# Troubleshooting

Symptom → likely cause → fix. Most issues fall into three families:
display, pricing, inventory.

## Display

### The bundle block doesn't appear in my theme editor

**Cause:** Theme is Vintage (not Online Store 2.0). Theme app blocks
require OS 2.0 templates.

**Fix:** Use the Liquid include. See
[storefront.md → Vintage themes](storefront.md#vintage-themes).

### The bundle block renders but is empty (no products)

**Cause:** Bundle isn't published, or theme block isn't pointing at
the right bundle.

**Fix:**
1. In MintBundle admin, open the bundle and verify status is
   **active** (not draft or archived).
2. In the theme editor, click the block and confirm the **Bundle**
   dropdown is set to the right bundle.

### "Add to cart" button does nothing

**Cause:** Bundle item references a product that's been deleted or
unpublished from your Shopify catalog.

**Fix:**
1. Open the bundle's **Items** panel.
2. Any row with a red badge is a broken reference.
3. Replace or remove broken items, then re-publish.

### Storefront shows old prices after I edited a bundle

**Cause:** Shopify's CDN caches the storefront for ~60 seconds.

**Fix:** Wait one minute and hard-refresh (Cmd+Shift+R / Ctrl+F5).
If still wrong, see [Pricing → Cart and checkout disagree](#cart-and-checkout-show-different-totals).

## Pricing

### Cart and checkout show different totals

**Cause:** Cart Transform Function isn't deployed, or its version is
behind the server's pricing engine.

**Fix:**
1. In the MintBundle admin, **Settings → Pricing** has a "Re-deploy
   Cart Transform" button. Click it.
2. Wait ~30 seconds (Shopify's function deploy is async).
3. Reload your storefront and try again.

If you're self-hosting:

```bash
shopify app deploy
```

(That deploys all extensions including the Cart Transform function.)

### A pricing rule isn't applying

Most common causes, in order:

1. **The rule's conditions don't match** — e.g. `minQuantity: 3` but
   only 2 in cart. Open the rule and check each condition against the
   actual cart state.
2. **A higher-priority non-stackable rule already matched** — only
   the first matching rule runs unless `isStackable: true`. Lower the
   priority number on the rule you want to win, or mark earlier rules
   stackable.
3. **The rule has expired** (`endsAt` is in the past) or hasn't started
   yet (`startsAt` is in the future).

### "20% off" applies once instead of compounding across rules

**Cause:** `isStackable` is `false` (default).

**Fix:** Open each rule that should cumulate, toggle **Stackable**.
Watch the order — stackable rules apply in priority order, and each
one operates on the result of the previous. See
[Pricing → Stacking](pricing.md#stacking).

## Inventory

### A bundle won't publish — "Component SKU has tracking disabled"

**Cause:** Shopify product variant has "Inventory not tracked" set.
MintBundle can't decrement what Shopify isn't counting.

**Fix:** In Shopify admin → Products → that variant → enable
**Track quantity**. Re-attempt publish.

### Bundle says "out of stock" but components are in stock

**Cause:** One of the components has zero stock at the location your
bundle is configured for. The bundle is only as available as its
scarcest component.

**Fix:**
1. Open **Inventory → Health** in MintBundle admin.
2. The bundle row shows which component is the bottleneck.
3. Restock that SKU, or remove it from the bundle and re-publish.

### Inventory drift — Shopify and MintBundle disagree on stock

**Cause:** Manual edit to Shopify inventory outside the
`inventoryLevels` API (e.g. CSV import, third-party tool that
bypasses webhooks).

**Fix:**
1. **Inventory → Health** has a **Reconcile from Shopify** button.
2. Click it; MintBundle re-reads Shopify's current inventory and
   writes a reconciliation entry to the audit log.
3. Future writes resume normally.

## Auth and install

### "App couldn't be loaded — issue with browser cookies"

**Cause:** The browser is blocking third-party cookies and the embed
headers aren't right. This was a real bug in MintBundle before
session 0157 (fixed by dropping `Cross-Origin-Opener-Policy:
same-origin`).

**Fix:** Ensure you're on the latest deploy. If still happening,
check the browser console for CSP errors and report them.

### Install loops back to the install screen

**Cause:** Stale OAuth state in the browser, or the app's `client_id`
in `shopify.app.toml` is out of sync with the Partner dashboard.

**Fix:**
1. Open the dev store admin in an incognito window.
2. Re-install from the Partner dashboard "Test on dev store" button.
3. If it still loops, run `npx shopify app config push` to sync the
   toml.

### Pages show a permanent loading spinner

**Cause:** The frontend's API call is being redirected to OAuth (no
session token). This was a session-0157 bug fixed via the
`authFetch` patch in `frontend/src/lib/authFetch.ts`.

**Fix:** Hard-refresh the embedded admin (Cmd+Shift+R with DevTools
→ Network → "Disable cache"). If still spinning, the issue is
likely an API response shape mismatch — check the browser console.

## Webhooks and orders

### A bundle order didn't decrement inventory

**Cause:** The `orders/paid` webhook isn't reaching the worker, or
it's failing.

**Fix:**
1. Open the MintBundle admin → **Settings → Webhooks**. The status
   shows whether webhooks are reaching us.
2. If they aren't: in Shopify Partners dashboard → your app →
   Webhooks, verify the URL is your live MintBundle URL.
3. If webhooks are reaching us but failing, check the worker logs
   (`outstanding-nourishment` service on Railway, or `npm run start:worker`
   locally).

### "Webhook signature mismatch" in logs

**Cause:** `SHOPIFY_API_SECRET` env var doesn't match the secret in
the Shopify Partner dashboard. Often happens after rotating the
secret in Partners without updating Railway.

**Fix:** Update `SHOPIFY_API_SECRET` in your hosting provider, restart
the service.

## Still stuck?

- Check **Settings → Diagnostics** in the admin — it shows env health,
  webhook delivery status, and recent errors.
- Look at the **Activity log** in `/api/v1/inventory/audit` — it shows
  the last 200 inventory events with timestamps.
- For self-hosted installs, the structured logs (`pino`) include the
  request ID, which you can paste into a support email.

If escalating: your dev store's `*.myshopify.com` domain + the
request ID from the failing call is enough for support to start
investigating.

---

**Next:** [FAQ](faq.md).
