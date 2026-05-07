# Session 0201 — M-201 80%-of-cap admin banner

- **Date:** 2026-05-07
- **Milestone(s):** M-201
- **Branch:** claude/objective-sinoussi-77ae86
- **Commit(s):** (this session)

---

## Goal

M-200 enforced the Starter `maxOrdersPerMonth` cap at the storefront
proxy — but the merchant only learned about the cap when their
storefront started rejecting bundle checkouts. That's a hard wall;
this milestone turns the cap into a soft conversion signal in the
admin BEFORE it bites.

## What was done

### Backend

- `src/routes/billing.ts`
  - Added `loadOrderCap` injection seam on `BillingDeps`.
  - `GET /api/v1/billing` now calls `isOverOrderCap` and includes an
    `orderCap` field in the response:
    ```ts
    orderCap: { plan, cap, count, over, approaching }
    ```
  - `approaching` is derived at the API boundary
    (`count / cap >= 0.8 && !over`) — keeps the M-200 service
    purely binary so the storefront gate doesn't accidentally
    start rejecting at 80%.
- `src/routes/billing.test.ts`
  - `buildApp` now seeds a default `loadOrderCap` stub so the
    pre-existing tests don't hit Prisma.
  - +4 cases covering the 79/80/100/null-cap matrix on the GET
    response.

### Frontend

- `frontend/src/components/dashboard/OrderCapBanner.tsx` (new)
  - Pure presentational Polaris `Banner` component. Renders nothing
    on paid plans (cap=null) or under threshold; renders a warning
    banner when approaching; renders a critical banner when over.
  - Primary action: "Upgrade to Growth" → navigates to
    `/settings#billing` by default; injectable `onUpgrade` for
    tests.
- `frontend/src/components/dashboard/OrderCapBanner.test.tsx` (new)
  - 6 cases: null status, paid-plan, under-threshold,
    approaching-warning, over-critical, click → onUpgrade fires.
- `frontend/src/pages/DashboardPage.tsx`
  - Added a fire-and-forget `fetch("/api/v1/billing")` on mount
    that hydrates `orderCap` state. Fetch failure is silent — the
    banner is a soft prompt; the storefront gate (M-200) is the
    real protection.
  - Mounted `<OrderCapBanner status={orderCap} />` directly above
    `<SetupChecklist>` inside the existing `<BlockStack gap="500">`.

## Acceptance criteria status

- [x] `npm run typecheck` — clean.
- [x] `npm run lint` — 2 pre-existing errors unchanged, no new
      from this milestone.
- [x] `npx vitest run src/routes/billing.test.ts` — 12/12.
- [x] `npx vitest run frontend/src/components/dashboard/OrderCapBanner.test.tsx`
      — 6/6.
- [x] Full suite: 850 pass / 13 skip / 863 total (+10 new).
- [x] Static check (Starter, count=80) — warning banner renders
      with "used 80 of 100" copy.
- [x] Static check (Starter, count=100) — critical banner renders
      with "reached your Starter monthly order limit (100)" copy
      and "New bundle checkouts are blocked" body.
- [x] Static check (Growth, count=50_000) — banner does not render.
- [x] No DB migration. Reuses M-200's service.

## Notes

- `approaching` is derived in the API boundary (route handler), not
  in the `isOverOrderCap` service. Keeps the M-200 storefront-side
  gate purely binary — `over === true` means actually-over, never
  conflated with "approaching".
- Polaris `Banner` rendered inside `AppProvider` adds a
  `PolarisPortalsContainer` div even when the component returns
  `null`. The "renders nothing" test cases assert via the absence of
  the Upgrade-to-Growth button, not via `container.firstChild`.
- Cross-test portal leakage required explicit `cleanup()` in
  `afterEach` plus scoping queries to `within(container)` instead
  of the global `screen` — without these, the four
  rendered-banner tests saw doubled buttons.
- Banner's primary action navigates to `/settings#billing`. Settings
  page reads the hash on mount and switches to the Billing tab —
  already wired in M-167. So no additional frontend wiring needed.

## Deferred follow-ups (still in STATE.md)

- Trial-warning emails (needs SMTP wiring).
- 80%-of-cap email (separate from in-app banner; same SMTP need).
- Auto-upgrade nudge on paid plans at high volume (e.g.
  Growth at 50K+ orders/mo → "consider Pro" prompt).
- Banner on Bundle Detail / Bundle List pages — defer until a
  merchant actually reports they missed the Dashboard signal.
