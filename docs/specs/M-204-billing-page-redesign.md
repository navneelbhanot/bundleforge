# M-204 — Billing page redesign

## Why

Today's `BillingPanel` (Settings → Billing tab + standalone /billing
route) shows almost nothing useful: current plan name, status badge,
and a row of cards each with just `name`, `$X/mo or $Y/yr`, and two
subscribe buttons. None of the plan **features** are visible — the
12 fields in `PlanFeatures` (audit trail, AI suggestions, 3PL sync,
white-label, etc.) might as well not exist from the merchant's
perspective. There's also no way to tell at a glance which plan the
shop is currently on, no monthly/annual toggle, no "most popular"
nudge, and no caps comparison (5 bundles vs unlimited).

Result: merchants have no information to upgrade with. They click
into a tab, see four nearly-identical cards, and bounce. That's
exactly the friction the M-200/M-201/M-202 conversion pipeline is
trying to remove.

This milestone rebuilds the panel as a proper plan-comparison surface.

## Scope

In-scope:

1. **Layout** — four cards in a row at lg/xl (Starter, Growth, Pro,
   Enterprise), 2×2 at md, single column at xs/sm. Polaris `Grid`
   with `columnSpan={{ xs: 6, sm: 6, md: 3, lg: 3, xl: 3 }}` per
   cell.

2. **Per-card content** — in this order:
   - Plan name (heading) + "Most popular" badge on Growth, "Current
     plan" badge on whichever plan matches `state.plan`.
   - Price block — big monthly or annual based on the toggle, plus
     `or save 20% with annual` / `or pay monthly` subtext. Starter
     shows "Free" with no toggle effect.
   - Caps line: "5 bundles · 100 orders/mo" for Starter, "Unlimited
     bundles · Unlimited orders" for paid plans.
   - Feature list — checkmarks for every `PlanFeatures` flag the
     plan has set to `true`, in a stable order (a single list shared
     across plans, but unchecked items are hidden, not greyed
     out — keeps the cards scannable).
   - Action button — primary "Subscribe" / "Upgrade" / "Downgrade"
     based on plan-relative position to the current plan, OR a
     disabled "Current plan" pill when this card === current. On
     Starter for non-Starter shops: subdued tone "Downgrade to
     Starter" (existing cancel-subscription path; out of scope to
     fully wire here — render a tooltip "Cancel subscription
     instead" for now and keep the button disabled).

3. **Monthly / Annual toggle** — `ButtonGroup` with two segmented
   buttons at the top of the panel. Default to **Annual** (the
   discount-favouring choice). The toggle drives both the displayed
   price on each card and the `interval` value sent to
   `/api/v1/billing/subscribe`.

4. **Feature label registry** — new module
   `frontend/src/components/billing/featureLabels.ts` mapping each
   `PlanFeatures` key to a friendly label + optional one-line
   description (used in a future phase as a tooltip; for first ship
   just the label).

5. **Component split**:
   - `frontend/src/components/billing/PlanCard.tsx` — pure
     presentational, renders one card. Accepts `plan`, `features`,
     `caps`, `currentPlan`, `interval`, `busy`, `onSubscribe`.
   - `frontend/src/components/billing/IntervalToggle.tsx` — pure
     presentational, monthly/annual segmented control.
   - `BillingPanel.tsx` keeps the data fetching + composition.

6. **Tests**:
   - `PlanCard.test.tsx` — current-plan badge appears only on the
     matching plan; subscribe button fires `onSubscribe(plan,
     interval)`; "Most popular" appears only on Growth; Starter
     shows "Free" regardless of interval.
   - `IntervalToggle.test.tsx` — clicking either segment fires
     `onChange` with the correct value; both visual states render.
   - Update existing `SettingsPage.test.tsx` Billing assertions to
     match the new structure (the test currently looks for plan
     names + price strings; those still exist but the surrounding
     DOM changes).

Out-of-scope (future phases):

- Per-feature comparison table below the cards (collapsible).
- Inline downgrade confirmation modal.
- Trial-end countdown badge ("8 days left in trial — switch to
  annual to lock in 20% off").
- Switch-interval flow when current plan matches the card but
  interval differs (e.g. on Growth monthly, toggle says Annual,
  button could read "Switch to annual"). For first ship, treat
  same plan === current regardless of interval.

## Acceptance criteria

- [ ] `npm run typecheck` passes.
- [ ] `npm run lint` passes (no new errors beyond the 2 pre-existing).
- [ ] `npx vitest run frontend/src/components/billing/` — all green.
- [ ] `npx vitest run frontend/src/pages/SettingsPage.test.tsx` —
      remains green after the assertion updates.
- [ ] Static check: a Starter shop sees "Current plan" on the
      Starter card, "Most popular" on Growth, and the toggle
      defaults to Annual.
- [ ] Static check: a Growth shop sees "Current plan" on the Growth
      card. The Starter card's button is disabled.
- [ ] Toggle switches all three paid-plan prices and updates the
      `interval` sent to `/api/v1/billing/subscribe`.
- [ ] No backend change — same `/api/v1/billing` and
      `/api/v1/billing/plans` endpoints. New copy lives only in
      the frontend.

## Implementation notes

- The "Most popular" badge on Growth is a marketing hint, not a
  data signal — it's hardcoded in `PlanCard` based on
  `plan.name === "growth"`. Easy to move to a `recommended` flag
  on the plan registry later if we want it to vary by shop type.
- The feature ORDER in the registry is the order they render on
  every card. Pick an order that builds from "value" (visual
  builder) through "support" (live chat) to "advanced" (3PL,
  Flow, headless) so the Pro / Enterprise cards visually grow
  with the price.
- Starter card renders Subscribe button as disabled with label
  "Current plan" (when current) or "Downgrade" (when paid → free),
  but Downgrade is also disabled this milestone — clicking should
  do nothing, with a tooltip pointing at "Cancel subscription
  instead". The cancel path already exists at `POST
  /api/v1/billing/cancel`.
- Polaris's `Badge` and `Button` accept `tone` props (`success`,
  `info`, `attention`, `warning`, `critical`); keep tone choices
  consistent: success on Current plan, attention on Most popular,
  primary on the recommended action button.
- Mobile (xs/sm) breakpoint stacks the cards vertically — the
  toggle stays horizontal at the top.
