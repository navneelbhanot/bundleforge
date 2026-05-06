# Session 0170 — Bundle Detail · Schedule tab

- **Date:** 2026-05-06
- **Milestone(s):** M-170
- **Branch:** claude/objective-sinoussi-77ae86
- **Commit(s):** TBD

---

## Goal

Populate the Schedule tab placeholder added by M-169 with a real
form covering when a bundle is visible, recurrence, and what
happens at the end of the window.

## What was done

- **Spec written:** `docs/specs/M-170-bundle-detail-schedule.md`.

- **Prisma schema** (`prisma/schema.prisma`):
  - Added `scheduleSettings` JSONB column to `Bundle` (default
    `{}`). Migration in
    `prisma/migrations/20260506180000_bundle_schedule_settings/`
    — NOT applied per CLAUDE.md §5.

- **Types** (`src/types/index.ts`):
  - New types: `RecurringRuleType`, `RecurringRuleInput`,
    `ScheduleEndBehavior`, `ScheduleSettingsInput`.
  - Added `scheduleSettings?: ScheduleSettingsInput` to
    `CreateBundleInput`.

- **Service** (`src/services/bundles/index.ts`):
  - New `validateSchedule(input)` helper rejects:
    - Non-string / empty timezone.
    - `recurringRule.type` outside `daily | weekly | monthly | null`.
    - `daysOfWeek` without `type === "weekly"` or out-of-range
      values.
    - `dayOfMonth` without `type === "monthly"` or out-of-range.
    - `startTime` / `endTime` not matching `HH:MM`.
    - `endBehavior` outside `archive | pause`.
  - New `isObject` helper used by the deep-merge step.
  - `create()` validates + persists `scheduleSettings`.
  - `update()` deep-merges `scheduleSettings` so saving a
    single card doesn't drop sibling fields.
  - Both paths now also reject `endsAt < startsAt`.

- **Frontend** (`frontend/src/components/bundleDetail/ScheduleTab.tsx`,
  new file):
  - Three cards: `WindowCard`, `RecurrenceCard`,
    `EndBehaviorCard`.
  - Window: date + time inputs + IANA timezone Select. Cross-
    field check disables Save when end < start.
  - Recurrence: Polaris Select for pattern (None / Daily /
    Weekly / Monthly). Conditional fields render based on type:
    weekly → ChoiceList allowMultiple of days; monthly →
    dayOfMonth TextField. Daily/start/end time inputs render
    when type !== none.
  - End behavior: Polaris ChoiceList (single) for archive vs
    pause with copy explaining the difference. Banner notes
    M-170b is the cron worker that consumes this setting.
  - Each card has its own per-card Save that fires
    `onSave(patch)` to the page-level handler.

- **BundleDetailPage** (`frontend/src/pages/BundleDetailPage.tsx`):
  - `BundleDetail` interface gains `startsAt`, `endsAt`,
    `scheduleSettings`, `shopTimezone`.
  - Schedule tab branch in the active-tab switch wires
    `<ScheduleTab />` with the bundle's persisted state and the
    page's existing `save()` function as `onSave`.
  - Other 6 placeholders unchanged.

## Tests added

- `src/services/bundles/index.test.ts` (21 cases, +6):
  - Persists scheduleSettings on create.
  - Rejects unknown endBehavior.
  - Rejects daysOfWeek without weekly type.
  - Rejects endsAt before startsAt.
  - Deep-merge: saving timezone alone keeps recurringRule.
  - Validates schedule on update too (rejects dayOfMonth=99).

- `frontend/src/components/bundleDetail/ScheduleTab.test.tsx`
  (new, 5 cases):
  - Renders Window / Recurrence / End-behavior headings.
  - Picking weekly reveals the daysOfWeek choices.
  - Picking monthly reveals the day-of-month field.
  - Saving end-behavior sends only `scheduleSettings.endBehavior`.
  - Window card pre-fills date inputs from props.

- `frontend/src/pages/BundleDetailPage.test.tsx` (6 cases, +1):
  - Updated the placeholder regression to use `#customers` (Schedule
    is wired now).
  - New: `/bundles/:id#schedule` deep-link renders Window +
    Recurrence headings.

## Acceptance criteria status

- [x] Compiles, lints clean, 582/582 vitest pass.
- [x] /bundles/:id#schedule renders 3 real cards.
- [x] startsAt/endsAt round-trip with the new timezone field.
- [x] Recurring rule persists; deep-merge preserves siblings.

## Verified by hand

- `npx vitest run src/services/bundles/index.test.ts` → 21/21.
- `npx vitest run frontend/src/components/bundleDetail/ScheduleTab.test.tsx`
  → 5/5.
- `npx vitest run frontend/src/pages/BundleDetailPage.test.tsx`
  → 6/6.
- `npx vitest run` (full) → 582 passed, 13 skipped.
- `npm run typecheck` → clean.

## Deferred

- **M-170b** — cron worker job that runs auto-archive /
  auto-pause when a bundle's `endsAt` passes. The setting
  persists today; the worker that consumes it lands separately.
- Storefront block consumption of the recurring rule
  (`validateCart.ts` honors `startsAt`/`endsAt` only — per-cycle
  pattern is M-170c).
- Migration application — the file is created in source but not
  applied; `prisma migrate deploy` will pick it up next deploy.

## Notes

The interactive "save button stays disabled when end < start"
test was attempted but Polaris `<TextField type="date">` doesn't
propagate `fireEvent.change` reliably without
`@testing-library/user-event`. The equivalent server-side
validation is locked in by the `BundleService` "rejects endsAt
before startsAt" test in `src/services/bundles/index.test.ts`
— that's the actual safety net. The UI test covers what jsdom
*can* test reliably: that pre-loaded date props render correctly
into the date inputs.

The decision to put `scheduleSettings` in its own column (vs
nested under `config`) was deliberate: `config` is per-type and
runs through the type-discriminated Zod schema, which would
reject extra keys for types like `mix_match`. Adding a sibling
JSON column avoids that collision and matches the existing
`displaySettings` pattern.
