# M-170b — Schedule cron (auto-archive / auto-pause)

> Behavior wiring for M-170. The Schedule tab persists
> `endsAt` + `scheduleSettings.endBehavior`; M-170b adds the
> background job that actually flips a bundle's status when
> the schedule fires.

---

## Why

A merchant sets up a 7-day flash sale: starts Monday, ends
Sunday at midnight. The Schedule tab UX records this, but
the bundle stays `active` until someone clicks Archive
manually. M-170b closes the loop:

- A cron-like sweep runs every 5 minutes.
- For every bundle where `status = "active"` and
  `endsAt < now`:
  - If `scheduleSettings.endBehavior === "archive"` (or
    unset — archive is the default) → set status to
    `"archived"`.
  - If `scheduleSettings.endBehavior === "pause"` → set
    status to `"draft"`.
- Fire the same activity log entries M-174 added (so the
  merchant can see "Bundle archived" with timestamp on the
  Activity tab even though no human clicked).

## Why "pause" maps to "draft"

The Bundle status enum is `draft | active | archived |
deleted`. There's no separate "paused" state, and adding
one would mean a schema column + migration.

`draft` matches the "Move to draft" affordance the merchant
already gets from BundleDetailPage's archived-bundle
primary action — it hides from the storefront, keeps the
config intact, and can be re-published later. Functionally
identical to a pause.

---

## Scope

### Server

New `src/jobs/workers/scheduleSweep.ts`:
- Pure `processExpiredBundles(now, deps)` function:
  - Loads bundles where `status = "active" AND endsAt IS NOT NULL AND endsAt < now`.
  - For each, reads `scheduleSettings.endBehavior` (default
    `"archive"`).
  - Calls `archive()` or sets status `draft` accordingly.
  - Writes an activity log row (`auto_archived` /
    `auto_paused`).
  - Returns `{ archived: number, paused: number, errors:
    number }` so the caller can log a summary.

- `startScheduleSweep(deps)` factory wires it to a 5-minute
  setInterval. (BullMQ repeatable jobs would also work but
  setInterval is two lines and we don't need
  cross-process coordination — single-worker is fine.)

- The activity-log writer gets two new actions:
  `"auto_archived"` and `"auto_paused"`.

### No emit-site wiring needed

The sweep is a worker entry point; nothing else emits
into it. The existing M-174 activity log writers handle
the audit trail.

### Tests

- `src/jobs/workers/scheduleSweep.test.ts` (new, 5 cases):
  - Empty result when no bundle has expired.
  - "archive" endBehavior → calls archive().
  - "pause" endBehavior → updates status to "draft".
  - Default (no endBehavior set) → archive().
  - One row throws → captured in `errors` count, sweep
    keeps processing siblings.

---

## Acceptance criteria

- [x] Compiles, lints clean (no new violations), all
  vitest pass.
- [x] Pure `processExpiredBundles` is testable in isolation
  with a mocked Prisma + service.
- [x] "pause" endBehavior maps to status="draft"
  (documented).
- [x] Activity log writer accepts the two new actions.

---

## Out of scope (deferred)

- **Recurring rule** (`scheduleSettings.recurringRule`) —
  the daily/weekly/monthly cycle that pauses + resumes the
  bundle. Today's cron only handles the one-shot `endsAt`.
  Recurring needs a richer state machine (next run time
  computed from rule + last fire) — separate ticket.
- **Auto-publish at startsAt**. Today the merchant clicks
  Publish to flip a draft to active; the schedule's
  startsAt is informational. Wiring auto-publish requires
  the publish path to know which Shopify session to use,
  which the cron worker doesn't have. Solvable but not
  here.
- **Per-shop sweep cadence** — today every shop is swept
  every 5 minutes.
