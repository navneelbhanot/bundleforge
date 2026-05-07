# Session 0200 — M-200 Enforce Starter `maxOrdersPerMonth`

- **Date:** 2026-05-07
- **Milestone(s):** M-200
- **Branch:** claude/objective-sinoussi-77ae86
- **Commit(s):** (this session)

---

## Goal

Wire the dead `PLAN_CAPS.starter.maxOrdersPerMonth` field into actual
enforcement. Free-tier shops were able to process unbounded bundle
orders, contradicting the Starter pitch in `PRODUCT_PLAN.md` §6 and
exposing the app to free-rider abuse against Shopify Admin API
quotas, queue throughput, and DB writes.

Paid plans intentionally remain unlimited — the flat-rate-pricing
differentiator called out throughout `PRODUCT_PLAN.md` §3, §4, §6.

## What was done

### Service

- `src/services/billing/orderCap.ts` (new)
  - `startOfMonthUtc(now)` — first-of-month at 00:00:00 UTC.
  - `currentMonthBundleOrderCount(prisma, shopId, now)` — counts
    distinct `BundleOrder.shopifyOrderId` rows since
    `startOfMonthUtc(now)`. Counting at the Shopify-order level
    (not BundleOrder rows) means a multi-bundle cart counts once,
    matching the merchant-facing meaning of "100 orders/mo".
  - `isOverOrderCap(prisma, shop, now)` — returns
    `{ over, cap, count, plan }`. Plans with `maxOrdersPerMonth: null`
    short-circuit to `{ over: false, cap: null, count: 0, plan }`
    without touching the DB.
- `src/services/billing/orderCap.test.ts` — 13 unit tests covering
  startOfMonthUtc boundaries, count behaviour, and the four-plan
  matrix at 99 / 100 / 137 distinct orders.

### Proxy wiring

- `src/routes/proxy.ts` extended:
  - `ProxyDeps.orderCap?` injection seam (matches the existing
    `computePaused` pattern).
  - Default `defaultOrderCap` resolves the shop by `shopifyDomain`,
    delegates to `isOverOrderCap`. Returns `null` when the shop row
    is missing (defensive — fail-open so a mid-migration shop
    doesn't break checkout).
  - `/validate-cart` calls the cap before any bundle lookup.
    Over-cap responses are HTTP 200 with
    `{ valid: false, errors: [...], code: "order_cap_reached" }` so
    the storefront block (which already reads `valid`) renders the
    rejection cleanly.
  - Telemetry: cap rejections log `{ shopDomain, plan, count, cap }`
    at `info` level — gives ops a signal for future
    "consider upgrading" emails.
- `src/routes/proxy.test.ts` — 4 new cases:
  1. Starter at cap → 200 with `code: order_cap_reached`, bundle
     lookup short-circuited.
  2. Starter under cap → request flows through, `valid: true`.
  3. Growth (cap=null) → cap ignored.
  4. Shop row missing → fail-open, request continues.

### ESLint

- `eslint.config.mjs` — added `**/*.cjs` override turning
  `@typescript-eslint/no-require-imports` off. CommonJS scripts must
  use `require()`; the rule is meant for `.ts`/`.tsx`.
  - Cleared the 3 errors my session-0199 postinstall script created,
    plus 4 more in pre-existing `scripts/start-*.cjs` files (net
    error count moved from 6 → 2).

## Acceptance criteria status

- [x] `npm run typecheck` passes.
- [x] `npm run lint` — 2 pre-existing errors unchanged
      (NavMenu.tsx namespace, CustomersTab.tsx unused expression),
      no new errors from this milestone.
- [x] `npx vitest run src/services/billing/orderCap.test.ts` — 13/13.
- [x] `npx vitest run src/routes/proxy.test.ts` — 10/10 (was 6, +4).
- [x] Full suite: 840 pass / 13 skip / 853 total. (+13 new)
- [x] No schema migration needed; reuses `BundleOrder` table and
      its `(shop_id, created_at)` index.

## Notes / lessons

- The cap-rejection short-circuits BEFORE the bundle lookup. This
  saves the bundle DB hit on the hot pre-checkout path and avoids
  leaking metadata about which slugs exist to a shop that's
  effectively suspended.
- Counting `distinct shopifyOrderId` (vs row count) is what the
  spec ultimately landed on after considering that a cart with
  two different bundles writes two BundleOrder rows but counts as
  one merchant-facing order.
- UTC is fine for the cap window. Shopify's billing periods are
  UTC-aligned, so honouring `Shop.timezone` here would just buy
  inconsistency with billing dashboards.

## Deferred follow-ups (still in STATE.md)

- Admin banner in Settings → Billing when shop is at/over cap.
- Trial-warning + 80%-of-cap warning emails (cron worker job).
- Add a "Fair use" clause to `legal/terms-of-service.md` so paid
  plans have a contractual safety valve if a single shop ever
  pushes pathological volume.
- Soft "consider upgrading" prompt on Growth/Pro at very high
  monthly volume (50K+).
