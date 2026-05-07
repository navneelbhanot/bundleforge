# M-201 — 80%-of-cap admin banner

## Why

M-200 enforces the Starter `maxOrdersPerMonth` cap at the storefront
proxy — once a Starter shop hits 100 distinct bundle orders in the
month, `/validate-cart` rejects further checkouts. That's a hard
wall and great for protecting infra, but as a *conversion* mechanism
it's blunt: the merchant only finds out something's wrong when
their storefront breaks.

This milestone adds a soft signal in the merchant admin BEFORE the
wall hits. The aim is to turn the cap into a natural Growth-upgrade
trigger:

- 80%+ of cap → friendly heads-up banner with an "Upgrade to
  Growth" CTA.
- 100%+ of cap → critical banner explaining bundle checkouts are
  currently blocked, same CTA.

Per `PRODUCT_PLAN.md` §6 and ToS §3.1, this signal exists ONLY for
Starter — paid plans (`maxOrdersPerMonth: null`) never see the
banner.

## Scope

In-scope:

1. Extend `GET /api/v1/billing` (in `src/routes/billing.ts`) to
   include an `orderCap` field on the response, populated via the
   existing `isOverOrderCap` service from M-200. Response shape adds:
   ```ts
   orderCap: {
     plan: PlanName;        // resolved shop plan
     cap: number | null;    // null = unlimited (paid plans)
     count: number;         // current month's distinct orders
     over: boolean;         // count >= cap
     approaching: boolean;  // count / cap >= 0.8 (false when cap is null)
   }
   ```
   Backwards compatible: existing callers that don't read `orderCap`
   are unaffected.

2. Frontend: render a Polaris `Banner` above the Dashboard widgets
   when `orderCap.approaching || orderCap.over`. Two visual states:
   - Approaching (warning tone): "You've used X of Y monthly bundle
     orders on Starter. Upgrade to Growth for unlimited orders."
   - Over (critical tone): "You've reached your Starter monthly
     order limit (Y). New bundle checkouts are blocked. Upgrade
     to Growth for unlimited orders." (Mirrors the storefront-side
     copy from M-200.)
   The banner's primary action navigates to `/settings#billing`
   (the Settings → Billing tab — already wired in M-167).

3. Tests:
   - Backend: extend `src/routes/billing.test.ts` with a case that
     asserts the new `orderCap` field on the GET response, with
     `approaching` correctly computed for 79 vs 80 vs 100 orders.
   - Frontend: extend `frontend/src/pages/DashboardPage.test.tsx`
     with cases for the four states (under threshold, approaching,
     over, paid plan ignored).

Out-of-scope (still in `STATE.md` deferred follow-ups):

- Email warning at 80% / trial-warning emails (different milestone,
  needs SMTP).
- Banner on Bundle Detail / Bundle List (Dashboard is the high-
  attention surface; if the merchant ignores it there, they'll
  also ignore it in three more places).
- Per-shop manual dismissal of the warning (the urgency point IS
  the banner; dismissing it would defeat the purpose). Follow-up
  if merchants complain.

## Acceptance criteria

- [ ] `npm run typecheck` passes.
- [ ] `npm run lint` passes (no new errors beyond the 2 pre-existing
      ones unrelated to billing).
- [ ] `npx vitest run src/routes/billing.test.ts` — green, including
      a new test that exercises the `orderCap.approaching` boundary.
- [ ] `npx vitest run frontend/src/pages/DashboardPage.test.tsx` —
      green, including the four banner-state cases.
- [ ] Static check: a Starter shop with 80 orders this month sees a
      warning banner; with 100, critical; with 79, no banner.
- [ ] Static check: a Growth shop never sees the banner regardless
      of order count.
- [ ] No DB migration. Re-uses `BundleOrder` and the M-200 service.

## Implementation notes

- The 80% threshold is hardcoded in `isOverOrderCap`'s caller (the
  billing route) — keep `isOverOrderCap` itself purely binary so
  the storefront proxy gate from M-200 doesn't accidentally start
  rejecting at 80%. The "approaching" derivation lives at the API
  boundary.
- The banner renders within the existing `<Page>` shell, above the
  `SetupChecklist` and the widget grid. Keep it inside the same
  `<BlockStack>` so spacing is consistent.
- Telemetry: log when the banner is rendered (frontend `console`
  is fine for now — a real analytics event is separate). Skip
  for MVP.
