# Runbook — Local Dev, Test, Deploy

> Reproducible commands. Updated when tooling changes (rare).

---

## Prerequisites

- Node.js 20 LTS (`node -v` should report `v20.x`)
- pnpm or npm (this repo uses npm; lockfile is `package-lock.json`)
- Docker + Docker Compose (for local Postgres + Redis)
- Shopify CLI: `npm i -g @shopify/cli @shopify/app`
- A Shopify Partner account and a development store (needed from M-016 onward)

## First-time setup

```bash
# 1. Install dependencies
npm install

# 2. Bring up Postgres + Redis (added in M-014)
docker compose up -d

# 3. Copy env template
cp .env.example .env
# Edit .env with local values. Required keys appear in src/config/env.ts
# once M-001 lands.

# 4. Generate Prisma client
npx prisma generate

# 5. Apply migrations to the local database
npx prisma migrate dev

# 6. (Optional) Seed dev fixtures
npx prisma db seed
```

## Daily commands

```bash
npm run dev          # Start the app server with hot reload
npm run typecheck    # tsc --noEmit
npm run lint         # ESLint
npm run test         # Vitest (unit + integration)
npm run test:watch   # Vitest watch mode
npm run e2e          # Playwright E2E (added later in build)
```

> Some scripts above are added in later milestones (M-011 to M-013 wire the CI
> equivalents). If a script does not exist yet, the milestone that adds it is
> noted in `docs/PLAN.md`.

## Database commands

```bash
npx prisma studio                        # GUI for the dev DB
npx prisma migrate dev --name <slug>     # New migration in dev
npx prisma migrate deploy                # Apply migrations in CI/prod
npx prisma migrate reset                 # Wipe + reseed (destructive)
```

### Local dev environment

Bring up Postgres 16 + Redis 7 with the bundled compose file:

```bash
docker compose up -d
# Wait a couple of seconds for the healthchecks
npx prisma migrate deploy
npm run db:seed
```

Default credentials in `docker-compose.yml`:

- Postgres: `postgres://bundleforge:bundleforge_dev@localhost:5432/bundleforge`
- Redis: `redis://localhost:6379`

Update your `.env` to match if you changed defaults.

### First-time apply

The initial schema migration was generated offline (M-009) and lives at
`prisma/migrations/20260504_init/`. The follow-up migration
`20260504_audit_log_immutable` installs Postgres triggers that enforce
ADR-0003.

The follow-up migration `20260504_audit_log_immutable` installs Postgres
triggers that enforce ADR-0003 (no UPDATE/DELETE on `inventory_audit_log`).

## Shopify Partner App setup

Required before OAuth flows (M-017) can run end-to-end:

1. Create a Shopify Partner account: https://partners.shopify.com
2. Create a new app. Choose "Custom distribution" or "Public app" as
   appropriate.
3. Generate API credentials and add them to your local `.env`:
   - `SHOPIFY_API_KEY`
   - `SHOPIFY_API_SECRET`
4. Edit `shopify.app.toml`:
   - Set `client_id` to your app's ID (visible in the partner dashboard).
   - Update `[auth].redirect_urls` and `[app_proxy].url` to your tunnel
     URL (`shopify app dev` prints one) or your production domain.
5. Create at least one development store and link it via
   `shopify app config link`.

The scopes in `shopify.app.toml [access_scopes]` must match
`SHOPIFY_SCOPES` in `.env`. M-016 keeps these in sync.

## Shopify commands (added M-016+)

```bash
shopify app dev          # Tunnel + reload + dev store install
shopify app deploy       # Push extensions + Functions
shopify app config link  # Link a partner app
```

## Boot phase shortcut

The session boot phase from `CLAUDE.md` §3.1:

```bash
npm run typecheck && npm run lint && npm run test && git status
```

Any failure is the session's first repair task.

## Branching

Working branch: `claude/review-product-plan-jfMlf`. All session commits land on
this branch unless the user names another. Each session ends with a push.

## Commit message format

```
M-NNN: <short imperative summary>

<optional body explaining subtleties>
```

Examples:

- `M-007: error handler middleware with Sentry capture`
- `M-024: webhook HMAC verifier; reject malformed payloads`

## Resetting a stale local environment

```bash
docker compose down -v   # Remove volumes — destroys local DB
docker compose up -d
npx prisma migrate reset
```

## Where to look when something is wrong

- `docs/STATE.md` — what was supposed to happen next.
- `docs/sessions/` — what the previous sessions actually did.
- `docs/decisions/` — why something is the way it is.
- `docs/specs/M-NNN-*.md` — the contract for the milestone you're on.
