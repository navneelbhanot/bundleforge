# Session 0186 — M-170b · Schedule cron

- **Date:** 2026-05-06
- **Milestone(s):** M-170b
- **Branch:** claude/objective-sinoussi-77ae86

---

## What was done

- **Spec:** `docs/specs/M-170b-schedule-cron.md`.
- **New worker** (`src/jobs/workers/scheduleSweep.ts`):
  - Pure `processExpiredBundles(now, deps)` function:
    finds bundles where `status="active"` and
    `endsAt < now`, then for each:
    - `endBehavior === "pause"` → status "draft"
      (matches the existing "Move to draft" UX from
      BundleDetailPage).
    - else (default `"archive"`) → status "archived".
    - Writes an activity-log row (`auto_archived` /
      `auto_paused`).
  - Returns `{ archived, paused, errors }` so the caller
    can log a tick summary.
  - `startScheduleSweep()` factory wires it to a 5-minute
    `setInterval` and runs once on boot so freshly deployed
    workers don't wait the first 5 minutes.
- **Activity-log enum** (`src/services/bundles/activityRepo.ts`):
  added `auto_archived` and `auto_paused` to
  `BundleActivityAction`.

## "Pause" maps to "draft"

The Bundle status enum is `draft | active | archived |
deleted` — no separate "paused" state. Adding one would
mean a schema migration. `draft` is functionally a pause:
hidden from storefront, config intact, can be re-published
later. Documented in the spec.

## Tests

- `scheduleSweep.test.ts` (new, 6 cases): empty result,
  archive endBehavior, pause endBehavior, default →
  archive, per-row error captured, findMany throw →
  returns zeros.

## Tests + lint

- `npx vitest run` → 727 passed, 13 skipped (+7 net).
- Typecheck clean.
- Lint baseline unchanged.
