# M-013 — CI test workflow

## Goal

Verify the `test` job in `.github/workflows/ci.yml` is correctly
configured. Add `db:migrate:test` step that applies migrations including
the audit-log immutability triggers. Make a small improvement: connect
the rate-limit test path so it never depends on real Redis (already done
in M-008 via the memory adapter, but worth a smoke test in CI).

## Why

Without a verified test job, CI is performative. M-013 is the milestone
that promises "merging requires green tests." Future milestones rely
on it.

## Out of scope

- Coverage reporting — M-139 (extended pricing tests + coverage gate).
- Flaky-test retry — only add when a flake is observed.

## Acceptance criteria

- [ ] `.github/workflows/ci.yml` test job runs:
  `npm ci`, `npx prisma generate`, `npx prisma migrate deploy`,
  `npm test`. (Already true from M-011.)
- [ ] Env block contains every var that `src/config/env.ts` requires.
- [ ] Locally, every test still passes.
- [ ] Audit-log immutability migration applies cleanly; no separate run
      step needed.

## Files touched

- `.github/workflows/ci.yml` (review only; no functional change expected).
- `docs/sessions/0013-ci-test.md` (new — record verification).
