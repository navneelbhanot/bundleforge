# Session 0204 — M-204 Billing page redesign

- **Date:** 2026-05-07
- **Milestone(s):** M-204
- **Branch:** claude/objective-sinoussi-77ae86
- **Commit(s):** (this session)

---

## Goal

Replace the threadbare BillingPanel (plan name + price + two
buttons, no features visible) with a proper plan-comparison
surface so merchants have actual information to upgrade with.

## What was done

- `frontend/src/components/billing/featureLabels.ts` — friendly
  label registry mapping each `PlanFeatures` flag to a one-line
  label, in a stable display order. Plus `PLAN_TAGLINE` and
  `summariseCaps()` helpers.
- `frontend/src/components/billing/IntervalToggle.tsx` — Polaris
  segmented `ButtonGroup`; pure presentational.
- `frontend/src/components/billing/PlanCard.tsx` — pure
  presentational pricing card. Renders header (badge), tagline,
  price block (responsive to interval), caps summary, trial
  badge, feature list with ✓ marks, state-aware action button
  (Subscribe / Upgrade / Downgrade / Current plan).
- `BillingPanel.tsx` rewritten to compose the new components in
  a Polaris Grid (4 across at lg/xl, 2 across at md, single
  column on mobile). Header card shows current plan + the
  IntervalToggle. Footer card lists "All plans include" features
  shared by every tier.
- 17 new tests:
  - `IntervalToggle.test.tsx` — 4 cases (default state, click
    behavior, both directions).
  - `PlanCard.test.tsx` — 13 cases (current/most-popular badges,
    Free for Starter regardless of interval, annual/monthly price
    swap, cap line for paid vs free plans, feature filtering,
    Subscribe/Upgrade/Downgrade button labels by plan-rank
    relation, busy disables, click fires correct args).

## Acceptance criteria status

- [x] `npm run typecheck` clean.
- [x] `npm run lint` — 2 pre-existing errors unchanged.
- [x] `npx vitest run frontend/src/components/billing/` — 17/17.
- [x] `npx vitest run frontend/src/pages/SettingsPage.test.tsx`
      — 20/20 (still green; the existing tests assert plan names
      + price strings, both still present in the new DOM).
- [x] Full suite: 891 pass / 13 skip / 904 total (+17 new).
- [x] No backend change — same `/api/v1/billing` and
      `/api/v1/billing/plans` endpoints. New copy in frontend only.

## Notes

- "Most popular" on Growth is hardcoded in PlanCard based on
  `plan.name === "growth"`. Easy to move to a `recommended` flag
  on the plan registry later.
- Polaris `Button` uses `aria-disabled="true"` for accessibility,
  not the native HTML `disabled` attribute. Tests check
  `getAttribute("aria-disabled")`. Same for the action button
  when `busy=true` or when card === current plan.
- "Downgrade" is intentionally disabled this milestone — the
  cancel-subscription flow exists at `POST /api/v1/billing/cancel`
  but wiring a one-click downgrade with confirmation modal is
  scope for a follow-up.
- Switch-interval flow (e.g. on Growth monthly, toggle annual,
  click → "Switch to annual") is also deferred. For first ship
  the same plan === current regardless of interval.
- Decimal-as-string fix from session 0203 still applies — this
  redesign doesn't change the wire format.

## Deferred follow-ups (still in STATE.md)

- One-click downgrade with confirmation modal.
- Switch-interval flow (monthly ↔ annual on the same plan).
- Trial-end countdown badge on the current-plan card.
- Per-feature comparison table below the grid (collapsible).
- M-203 trial-ending email + daily cron.
