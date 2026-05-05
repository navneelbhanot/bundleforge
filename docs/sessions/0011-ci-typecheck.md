# Session 0011 — CI typecheck workflow

- **Date:** 2026-05-04
- **Milestone(s):** M-011

## What was done

- Wrote `docs/specs/M-011-ci-typecheck.md`.
- Reorganized `.github/workflows/ci.yml`: split monolithic
  `lint-and-typecheck` job into three parallel jobs (typecheck, lint,
  test). Removed the deploy job (out of scope).
- Added `.npmrc` with `legacy-peer-deps=true` so `npm ci` works without
  explicit flags (matches the boot-phase repair done in M-001).
- Test job uses `npm test` (no coverage plugin yet).
- Lint job runs the no-op stub script — M-012 will replace.

## Acceptance criteria

- [x] Three parallel jobs in CI.
- [x] `.npmrc` set.
- [x] Local typecheck stays green.
- [x] Spec criteria satisfied.

## Handoff

Next: **M-012 — ESLint v9 flat config + CI lint job**. Add `eslint`,
`@typescript-eslint/eslint-plugin`, `@typescript-eslint/parser` (already
in deps) plus a flat `eslint.config.js`. Restore `lint` script to the
real ESLint command. Fix any introduced lint errors. Lint job in CI
will then pass.
