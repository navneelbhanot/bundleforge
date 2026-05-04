# M-012 — ESLint v9 flat config + CI lint

## Goal

Wire ESLint v9 with `typescript-eslint` flat config, restore the real
`lint` script, and have the CI lint job pass.

## Why

CLAUDE.md §3.1 boot phase requires lint to pass. M-001 deferred this;
M-012 fulfills the IOU. M-140 may later tighten rules.

## Out of scope

- Strict rule set. We start permissive (warnings, not errors) so the
  inherited stubs in `src/services/bundles/index.ts` and `src/webhooks/`
  do not block until their replacement milestones.

## Acceptance criteria

- [ ] `eslint.config.mjs` exists and uses typescript-eslint flat config.
- [ ] `npm run lint` exits 0 (warnings allowed, errors not).
- [ ] CI lint job passes locally simulated.
- [ ] `lint:real` script removed; `lint` and `lint:fix` use real ESLint.

## Files touched

- `eslint.config.mjs` (new — ESM, because flat-config CJS files trip the
  `no-require-imports` rule under default tseslint recommended).
- `package.json` (lint scripts).
