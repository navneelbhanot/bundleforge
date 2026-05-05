# Session 0150 — Launch (M-150..M-155)

- **Date:** 2026-05-05
- **Milestone(s):** M-150, M-151, M-152, M-153, M-154, M-155
- **Branch:** claude/review-product-plan-jfMlf

---

## Goal

Close the project: legal templates, demo seed data, beta onboarding,
App Store assets + listing copy, public launch checklist.

## What was done

### M-150 — Privacy + ToS templates
- `legal/privacy-policy.md` — scope, data we receive from Shopify
  (no end-shopper PII), retention, sub-processors, GDPR/CCPA rights
  pointing at our `/api/v1/gdpr/*` endpoints, security summary.
- `legal/terms-of-service.md` — service description, plan table (with
  the same numbers shipped in `src/services/billing/plans.ts`),
  acceptable use, 99.9% SLA target, warranty + liability caps.
- Both files use `{{placeholder}}` fields for legal review to fill in
  the operating entity, jurisdiction, addresses, sub-processor regions.

### M-151 — Demo seed data
- `prisma/seed.ts` extended with 5 additional bundles spanning the
  remaining types (BOGO, BxGy, multipack, subscription) plus 6 demo
  `BundleOrder` rows and 4 audit-log rows so the analytics, A/B,
  inventory pages all render with content immediately after install.
- `scripts/demo-reset.sh` — wipes + reseeds the dev shop. Refuses to
  run unless `DATABASE_URL` looks like a dev DB or `CONFIRM=yes`.

### M-152 — Beta onboarding
- `docs/onboarding-beta.md` — 30-minute walkthrough script: install →
  demo data → first real bundle → theme block → test order → activate.
  Includes a common-issue table with 5 entries pulled from the
  hardening sessions.

### M-153 — Screenshots + video
- `docs/launch/screenshots-spec.md` — 6 captures with page paths,
  element callouts, and captions.
- `docs/launch/video-script.md` — 60-second scene-by-scene with VO
  text, on-screen captions, and recording notes.

### M-154 — Submission package
- `docs/launch/app-listing.md` — App Store copy: name, tagline, short +
  long descriptions, 5 key benefits, integrations, plan table.
- `docs/launch/submission-checklist.md` — listing, assets, legal,
  technical, performance, billing, GDPR, support — everything that
  must be verified before clicking "submit".

### M-155 — Launch checklist
- `docs/launch/launch-checklist.md` — D-7 through D+1 timeline with
  owner roles, plus a rollback plan for the listing.

## Acceptance criteria status

- [x] Compiles (`npm run typecheck`)
- [x] Lint passes (no new warnings)
- [x] Tests pass (442 / 442 — same suite as M-141..M-149; this batch is
      doc + seed only)
- [x] All 6 launch milestones documented and committed

## Verified by hand

- Read every legal placeholder; confirmed nothing live points at a
  fake email or unsigned entity.
- Cross-checked the listing plan table against `PLAN_CAPS` in
  `src/services/billing/plans.ts`.
- Spot-checked the seed: BundleOrder fields match
  `prisma/schema.prisma` (shopifyOrderNumber, bundlePrice, etc.).

## Deferred

- Actual screenshot PNGs and video MP4 — these are produced by the
  user, not by Claude Code. The specs in `docs/launch/` define what
  to capture.
- Legal sign-off on the privacy/ToS templates — flagged in the spec.
- The OnboardingWizard "skip to demo data" button is described but
  the wiring lives in M-103's component; no code changes required
  here because the demo data ships as part of the seed and a beta
  flag in `Shop.settings` would gate the button.

## Surprises and learnings

- The pre-existing `prisma/seed.ts` referenced a few fields that don't
  exist in the current schema (`subtotal`, `bundleSnapshot`,
  `attribution`) — the function that uses them was never reached
  because no demo orders were created. The new code only uses fields
  that exist. If the seed is rerun against an older DB it may fail at
  the `BundleOrder.create` call — acceptable since seed runs against
  fresh schemas.

## Handoff

Project complete: M-000..M-155. STATE.md updated to reflect closure
and to point future work at post-launch backlog (legal review,
screenshot/video production, beta merchant scheduling).
