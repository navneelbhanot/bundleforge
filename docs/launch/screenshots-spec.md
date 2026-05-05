# App Store screenshots — capture spec (M-153)

Six screenshots, 1600×900 PNG, exported with the demo data from
`scripts/demo-reset.sh`. Crop tightly; let Polaris own the chrome.

## 1 — Dashboard (analytics overview)

- Page: `/admin/apps/bundleforge`
- Show: top KPIs (total revenue, orders, top bundles), trend chart for
  the last 30 days, top-3 bundles by revenue.
- Caption: **"See what's working at a glance."**

## 2 — Bundle detail

- Page: `/admin/apps/bundleforge/bundles/<id>` for "Build Your Own Box".
- Show: items grid, pricing rules editor with two stackable rules
  expanded, the live Polaris price preview.
- Caption: **"Bundles, mix-and-match, BOGO, volume — all in one
  editor."**

## 3 — Storefront block (the real value-prop)

- Capture the *storefront* product page (not the admin) with the
  `bundleforge-bundle` block rendered: image grid + add-to-cart with
  discount badge.
- Caption: **"Your theme, your brand — our pricing engine."**

## 4 — Inventory health

- Page: `/admin/apps/bundleforge/inventory/health`
- Show: a few SKUs with computed bundle stock + drift column.
- Caption: **"Inventory accurate to the SKU. No more overselling."**

## 5 — A/B testing

- Page: `/admin/apps/bundleforge/abtests`
- Show: a completed test with significance badge ("99.2% confident — B
  wins"), conversion delta, recommendation.
- Caption: **"Test pricing variants with built-in significance
  testing."**

## 6 — Mobile-first analytics

- Same dashboard view as #1, but in mobile DPR (375×812 viewport, scaled
  back to 1600×900 for the slot).
- Caption: **"Polaris-first. Mobile-perfect."**

## Notes for capture

- Use Chrome incognito + 1×; turn off the Datadog RUM banner if it shows.
- Light theme for all six.
- Hide debug toolbars: `localStorage.setItem("polaris-debug","off")`.
- Crop with the captured image at 1600×900; drop into the `assets/`
  folder of the listing repo.
