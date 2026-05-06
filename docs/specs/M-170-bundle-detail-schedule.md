# M-170 — Bundle Detail · Schedule tab

> Second milestone of Phase R2 (`docs/plans/rich-admin-ui-roadmap.md`).
> First R2 milestone with real form content — populates the
> placeholder added in M-169.

---

## Why

Today merchants can set `startsAt` and `endsAt` on a bundle (the
columns exist), but there's no UI surface — they're invisible.
There's also no way to:

- Set the timezone for the schedule (Shopify orders default to
  shop timezone, but a merchant running a "midnight Friday" sale
  needs to pick which midnight).
- Configure recurrence (weekly Friday 00:00 → Monday 23:59 etc.).
- Decide what happens at `endsAt`: auto-archive (status=archived)
  or auto-pause (status=draft, can be re-enabled without losing
  the scheduled window).

This milestone surfaces all four. As with R1's "ship the option,
wire the behavior later" pattern: `startsAt`/`endsAt` already
plumb through to validateCart.ts (the storefront block hides
out-of-window bundles); the new fields persist now and the cron
worker that does auto-archive lands in M-170b.

---

## Scope

### Server — Prisma schema

Add a single JSON column `scheduleSettings` to the `Bundle` model:

```prisma
scheduleSettings   Json      @default("{}") @map("schedule_settings")
```

Migration file: `prisma/migrations/<ts>_bundle_schedule_settings/migration.sql`.

Stored shape:
```jsonc
{
  "timezone": "America/Los_Angeles",
  "recurringRule": {
    "type": "daily" | "weekly" | "monthly" | null,
    "daysOfWeek": [0, 1, 2, 3, 4, 5, 6],   // weekly only
    "dayOfMonth": 15,                      // monthly only
    "startTime": "09:00",                  // 24h
    "endTime": "23:59"
  } | null,
  "endBehavior": "archive" | "pause"
}
```

`startsAt` and `endsAt` continue to live as columns. The
`recurringRule` is the next-level scheduling refinement — when
populated, the storefront treats `startsAt`/`endsAt` as the
overall window AND the rule as the per-cycle pattern within it.

### Server — types + service

- Extend `CreateBundleInput` in `src/types/index.ts` with
  optional `scheduleSettings: { timezone?, recurringRule?, endBehavior? }`.
- `src/services/bundles/index.ts`:
  - `create()` already passes through `startsAt`/`endsAt`. Add a
    pass-through for `scheduleSettings` JSON.
  - `update()` deep-merges `scheduleSettings` so the merchant can
    save just the timezone without dropping the recurring rule
    (same pattern as M-162 settings deep-merge).
- Validation:
  - `scheduleSettings.timezone` must be a non-empty string (we
    don't validate against the IANA list — Shopify already does).
  - `scheduleSettings.recurringRule.type` must be in
    `["daily", "weekly", "monthly"]` if present.
  - `scheduleSettings.recurringRule.daysOfWeek` only valid for
    `type: "weekly"` and must be 0..6.
  - `scheduleSettings.recurringRule.dayOfMonth` only valid for
    `type: "monthly"` and must be 1..31.
  - `scheduleSettings.endBehavior` must be in
    `["archive", "pause"]` if present.

### Frontend

- New `frontend/src/components/bundleDetail/ScheduleTab.tsx`.
- Three cards:
  1. **Window** — start date + start time, end date + end time,
     timezone Select. Validation: end must be ≥ start (when both
     set). Save button persists via PUT.
  2. **Recurrence** — Select for type (None / Daily / Weekly /
     Monthly), conditional fields:
     - Weekly: `ChoiceList allowMultiple` for daysOfWeek (Mon..Sun
       checkboxes).
     - Monthly: TextField for dayOfMonth (1..31).
     - Daily: just startTime + endTime (already in the Window
       card — note this).
  3. **End behavior** — `ChoiceList` (single) for archive vs
     pause, with helpText explaining the difference.

- Plumb the new tab into `BundleDetailPage`:
  - Fetch `bundle.scheduleSettings` from GET response (ignore
    field if missing, treat as `{}`).
  - Replace the Schedule tab placeholder with `<ScheduleTab />`.
  - Pass `bundle.startsAt` / `endsAt` / `scheduleSettings` as
    props; receive `onSave(patch)` from the page.

### Tests

- `src/services/bundles/index.test.ts` — extend:
  - Create with full scheduleSettings → round-trips.
  - Update only `scheduleSettings.timezone` doesn't drop the
    recurringRule.
  - Update with `endBehavior: "weird"` → 400 (Zod rejects).
- `frontend/src/components/bundleDetail/ScheduleTab.test.tsx`
  (new):
  - Renders Window / Recurrence / End behavior headings.
  - Picking "weekly" shows the daysOfWeek choicelist.
  - Picking "monthly" shows the dayOfMonth field.
  - Saving fires `onSave` with the right shape.

---

## Acceptance criteria

- [x] Compiles, lints, all vitest pass.
- [x] /bundles/:id#schedule renders 3 real cards.
- [x] startsAt/endsAt round-trip with the new timezone field.
- [x] Recurring rule persists; deep-merge preserves siblings.

---

## Out of scope (deferred)

- **M-170b** — cron worker job that runs the auto-archive /
  auto-pause when a bundle's `endsAt` passes. The setting
  persists today; the worker that consumes it lands separately.
- Storefront block consumption of the recurring rule (today
  `validateCart.ts` honors `startsAt`/`endsAt` only — the
  per-cycle pattern is M-170c).
- Migration application — the migration file is created in
  source but not applied; per CLAUDE.md §5 the user reviews +
  applies on next deploy.
