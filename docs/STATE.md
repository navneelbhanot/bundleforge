# STATE.md — Live Project State

> Updated at the end of every session, in the same commit as the work.

---

## Current milestone

**M-121 — Klaviyo adapter**

## Exact next action

Boot phase, then write `docs/specs/M-121-klaviyo.md`. Klaviyo adapter
follows the M-116 framework: pushes a `Bundle Purchased` event to the
Klaviyo metric API. Credentials: `{privateKey: string}`. Register in
`src/services/integrations/registry.ts`; 4 unit tests (ping, pushOrder
happy + non-2xx + missing key).

## Blockers

None.

## Carry-overs (still active)

- npm audit findings → M-140 (security review).
- Broader Shopify SDK upgrade (api v13, app-express v7, prisma v6)
  flagged for ADR before going live.
- ResourcePicker integration on ProductPicker (M-099) deferred until
  App Bridge actions are wired.
- Theme-extension Playwright tests → M-141.
- Analytics materialized views deferred — M-138/M-139 may revisit if
  query times grow.
- Amazon adapter (M-118) is a basic stub; SP-API SigV4 signing in a
  follow-up when SP-API creds are available.

## Recently completed

- M-120 — Bold adapter. `docs/sessions/0116-integrations.md`.
- M-119 — Recharge adapter. `docs/sessions/0116-integrations.md`.
- M-118 — Amazon adapter (stub). `docs/sessions/0116-integrations.md`.
- M-117 — ShipStation adapter. `docs/sessions/0116-integrations.md`.
- M-116 — Integration adapter framework. `docs/sessions/0116-integrations.md`.
- M-109..M-115 — Analytics + A/B. `docs/sessions/0109-analytics-ab.md`.
- M-101..M-108 — Admin pages (rules editor, orders, inventory, settings,
  billing, onboarding). `docs/sessions/0101-admin-pages.md`.
- (Earlier history in PLAN.md.)

## Working branch

`claude/review-product-plan-jfMlf`
