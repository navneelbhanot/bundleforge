# Session 0012 — ESLint v9 flat config + CI lint

- **Date:** 2026-05-04
- **Milestone(s):** M-012

## What was done

- Wrote `docs/specs/M-012-eslint.md`.
- Installed `typescript-eslint` meta package (eslint v9 + plugin + parser).
- Added `eslint.config.mjs` (ESM flat config; CJS form trips the
  `no-require-imports` rule that ships in tseslint recommended).
- Restored `lint` and `lint:fix` scripts to real ESLint commands. Dropped
  `lint:real`.
- Lint runs clean with 25 warnings (all in known stubs scheduled for
  rewrite: services/bundles M-049, webhooks M-024, errorHandler one
  intentional `any`). Zero errors.

## Acceptance criteria

- [x] All spec items satisfied; boot phase green (81 tests + 0 errors).

## Surprises and learnings

- typescript-eslint recommended config rejects CommonJS `require()`. ESM
  config file or a per-file rule disable is required. We chose ESM.
- 25 warnings live entirely in stub files. Each stub's replacement
  milestone is implicitly responsible for clearing its warnings.

## Handoff

Next: **M-013 — CI test workflow**. The `test` job is already in
`.github/workflows/ci.yml`. M-013 verifies it: ensure tests pass with
the env in CI (matches tests/setup.ts), confirm Postgres + Redis
services are reachable, ensure migrate deploy runs successfully.
