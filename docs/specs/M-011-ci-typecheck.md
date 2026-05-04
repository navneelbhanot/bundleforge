# M-011 — CI: typecheck workflow

## Goal

Reorganize `.github/workflows/ci.yml` into three discrete, parallel jobs
(typecheck, lint, test) and ensure the `typecheck` job runs cleanly on
every push and PR.

## Why

Splitting the existing `lint-and-typecheck` job into independent jobs
makes failures easier to triage, and allows the lint and test jobs to
land separately in M-012 and M-013 without re-touching this milestone's
work.

## Out of scope

- Lint job behavior — M-012 wires the actual ESLint config.
- Test job behavior — M-013 will iterate on services and env.
- Deployment — out of scope for the foundations phase.

## Design

```yaml
jobs:
  typecheck:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - run: npx prisma generate
      - run: npm run typecheck

  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - run: npx prisma generate
      - run: npm run lint

  test:
    runs-on: ubuntu-latest
    services: { postgres: ..., redis: ... }
    env: { ... }
    steps: [ ..., npm test ]
```

`.npmrc` (added in this milestone) carries `legacy-peer-deps=true` so
`npm ci` works without explicit flags.

## Acceptance criteria

- [ ] `.github/workflows/ci.yml` has separate `typecheck`, `lint`, `test`
      jobs.
- [ ] `.npmrc` set to legacy-peer-deps.
- [ ] Locally simulating the typecheck job (`npm ci && npx prisma
      generate && npm run typecheck`) succeeds.
- [ ] M-011 leaves `lint` script as the M-001 no-op (M-012 changes it).
- [ ] M-011 leaves `test` step using `npm test` (no coverage dep yet).

## Files touched

- `.github/workflows/ci.yml`
- `.npmrc` (new)
