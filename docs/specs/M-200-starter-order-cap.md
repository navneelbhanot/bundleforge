# M-200 — Enforce Starter `maxOrdersPerMonth`

## Why

`PLAN_CAPS.starter.maxOrdersPerMonth = 100` exists in
`src/services/billing/plans.ts` but is dead code — no middleware reads
it. Free-tier shops can therefore process unbounded bundle orders,
which (a) contradicts the Starter pitch in `PRODUCT_PLAN.md` §6 ("5
bundles, 100 orders/mo, all bundle types"), and (b) leaves the door
open to a free-rider exhausting Shopify Admin API quotas, queue
throughput, and DB writes against our cost basis.

Paid plans (Growth/Pro/Enterprise) keep `maxOrdersPerMonth = null`
(unlimited) — that's the intentional flat-rate-pricing
differentiation called out throughout `PRODUCT_PLAN.md` §3, §4, §6.
This milestone enforces ONLY the Starter cap.

## Scope

In-scope:

1. New service `src/services/billing/orderCap.ts` with two pure
   functions:
   - `currentMonthBundleOrderCount(prisma, shopId, now)` — count
     **distinct Shopify orders** (not BundleOrder rows — a single
     Shopify order can spawn multiple BundleOrder rows when a cart
     contains several different bundles) where `shopId` matches and
     `createdAt >= startOfMonthUtc(now)`.
   - `isOverOrderCap(prisma, shop, now)` — returns
     `{ over: boolean; cap: number | null; count: number }`.
     `over: false` whenever the plan's `maxOrdersPerMonth` is `null`.

2. Wire into the `/api/proxy/validate-cart` endpoint
   (`src/routes/proxy.ts`). When `over === true`, respond with
   `{ valid: false, errors: ["This shop has reached its monthly bundle
   order limit. Upgrade to Growth for unlimited orders."], code:
   "order_cap_reached" }` and HTTP 200 (the storefront block already
   reads `valid` to gate add-to-cart).

3. Tests:
   - Unit tests for `currentMonthBundleOrderCount` (boundary at month
     start, distinct-order de-dup, returns 0 for shop with no orders).
   - Unit tests for `isOverOrderCap` (Starter at 99 vs 100 vs 101 on
     calendar boundaries; Growth/Pro/Enterprise always `over: false`).
   - Integration tests on the proxy route (over-cap rejects,
     under-cap allows, paid-plan ignores cap entirely).

Out-of-scope (future work, tracked in `docs/STATE.md`):

- Admin banner in Settings → Billing when shop is at/over cap.
- Email warning when shop crosses 80% of cap.
- A "Fair use" clause in `legal/terms-of-service.md` for paid plans
  (per the recommendation in the M-200 design conversation).
- Soft auto-upgrade prompt on Growth/Pro at high order volume.

## Acceptance criteria

- [ ] `npm run typecheck` passes.
- [ ] `npm run lint` passes (no new errors).
- [ ] `npx vitest run src/services/billing/orderCap.test.ts` — all
      cases green.
- [ ] `npx vitest run src/routes/proxy.test.ts` — existing tests still
      green AND new cap-enforcement cases pass.
- [ ] Static check: a Starter shop with 100 distinct Shopify orders
      this calendar month receives
      `{ valid: false, code: "order_cap_reached" }` from the
      `/validate-cart` proxy endpoint.
- [ ] Static check: a Growth shop with 50,000 distinct Shopify orders
      this calendar month receives `valid: true` (cap is `null`).
- [ ] No schema migration needed — re-uses `BundleOrder` table and the
      existing `(shop_id, created_at)` index.

## Implementation notes

- `currentMonthBundleOrderCount` uses
  `prisma.bundleOrder.findMany({ where: { shopId, createdAt: { gte:
  startOfMonthUtc } }, distinct: ["shopifyOrderId"], select: {
  shopifyOrderId: true } })` then `.length`. Distinct-on-bigint is
  supported by Prisma + Postgres.
- The proxy's existing `BundleLookup` injection seam doesn't cover
  `bundleOrder.findMany`. Extend `ProxyDeps` with an optional
  `orderCap?: (shopId: string, now: Date) => Promise<{ over: boolean;
  cap: number | null; count: number }>` so tests can stub without
  hitting Prisma. Default wiring uses `prisma` directly.
- The shop's plan is read via `Shop.planName` (the Prisma field
  already exists; Stagger free-tier shops default to `"starter"`).
- Calendar month boundary: UTC. Don't try to honor `Shop.timezone`
  — the cap is a billing-period concept, billing periods at Shopify
  are UTC-aligned, and the small TZ skew is acceptable.
- Telemetry: log `{ shopId, plan, count, cap }` at `info` level on
  every cap-rejection so we can spot patterns of merchants hitting
  the cap (which is the signal to email a "consider Growth" prompt
  in a future milestone).
