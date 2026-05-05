# M-001 — Environment Validation and Secrets Bootstrap

> Spec written before implementation. Edit only as understanding evolves; log
> meaningful changes in the next session log.

---

## Goal

Provide a single, type-safe entry point for reading process environment
variables, validated by Zod at boot, with a tested public API and an
`.env.example` that exactly matches the schema.

## Why

Every other module in the codebase will depend on `env`. If env handling is
fragile, every downstream session inherits the fragility. Doing this once,
properly, removes a class of "works on my machine" bugs and gives every later
milestone a single source of truth for what configuration the app needs.

This is the foundation of ARCHITECTURE.md §6 (security): encryption keys,
Shopify OAuth secrets, and database/Redis credentials all flow through this
module.

## Out of scope

- Secret encryption at rest (M-002 — `src/utils/encryption.ts`).
- Sentry initialization (M-015).
- Loading env from anything other than `process.env` + a `.env` file (no AWS
  Secrets Manager / Vault adapter today).
- Validating that secrets are correctly *formatted* for their downstream
  systems (e.g. that `DATABASE_URL` actually connects). Schema validation
  only.
- Hot-reloading env changes. Boot-time validation is sufficient.

## Design

### File layout

- `src/config/env.ts` — schema + lazy validator + exported `env` object.
- `src/config/env.test.ts` — colocated unit tests.
- `.env.example` — template for local dev, kept in lockstep with the schema.
- `vitest.config.ts` — test runner config (new; first time we run tests).

### Public API

```ts
// src/config/env.ts
import type { z } from "zod";

export const envSchema: z.ZodObject<...>;
export type Env = z.infer<typeof envSchema>;

/** Validates process.env against envSchema. Throws on first invalid env. */
export function loadEnv(source?: NodeJS.ProcessEnv): Env;

/** Lazily-initialized validated env. First read triggers validation. */
export const env: Env;
```

Key design points:

- `loadEnv()` accepts an optional `source` so tests can pass a fixture without
  mutating `process.env`.
- `env` is a `Proxy` (or simply a getter-backed singleton) that calls
  `loadEnv()` on first property access. This avoids the existing `process.exit(1)`
  pattern, which makes the module untestable.
- `loadEnv()` throws an `EnvValidationError extends Error` rather than calling
  `process.exit`. The Express server catches this at the top level and exits
  with a clean message.
- `dotenv` is imported at the top of `env.ts` so a `.env` file is loaded
  before `process.env` is read. This matches local-dev expectations without
  requiring the developer to remember `-r dotenv/config`.

### Schema (one source of truth)

Required:

- `SHOPIFY_API_KEY` — string, ≥ 1
- `SHOPIFY_API_SECRET` — string, ≥ 1
- `SHOPIFY_SCOPES` — comma-separated scope list, ≥ 1
- `SHOPIFY_APP_URL` — URL
- `SHOPIFY_AUTH_CALLBACK_PATH` — string starting with `/`, default `/api/auth/callback`
- `DATABASE_URL` — postgres:// URL
- `REDIS_URL` — redis:// or rediss:// URL
- `ENCRYPTION_KEY` — exactly 64 hex chars (32 bytes for AES-256-GCM). The
  current schema's `min(32)` is too loose — a 32-character ASCII key is not a
  32-byte key. Reject with a clear message that includes
  "openssl rand -hex 32" as a hint.

Optional:

- `SENTRY_DSN`
- `AI_SERVICE_URL` (URL) and `AI_SERVICE_API_KEY` (string) — paired; if either
  is set, both must be set.

With defaults:

- `NODE_ENV` — enum `development | production | test`, default `development`
- `PORT` — number coerced from string, default `3000`
- `LOG_LEVEL` — enum `error | warn | info | debug`, default `info`
- `APP_NAME` — string, default `BundleForge`
- `APP_VERSION` — string, default read from `package.json` at build time;
  for now, default `0.1.0`

Removed from current schema:

- The current schema does not have `SHOPIFY_AUTH_CALLBACK_PATH` even though
  `.env.example` lists it. M-001 reconciles this by adding it to the schema.

### Error format

`EnvValidationError.message` lists every failed field with its reason on its
own line. Example:

```
Invalid environment configuration:
  SHOPIFY_API_KEY: Required
  ENCRYPTION_KEY: Must be exactly 64 hex characters (32 bytes). Generate with: openssl rand -hex 32
  AI_SERVICE_URL: Invalid URL
```

The server entry point (`src/server/index.ts`, hardened in M-006) catches this
and `process.exit(1)`s with the message. The module itself never exits.

## Acceptance criteria

- [ ] `npm run typecheck` passes.
- [ ] `npm run lint` passes (or, if eslint config is missing, the spec
      explicitly notes that lint is M-012's job and `lint` is allowed to be
      a no-op for now — see "Open questions").
- [ ] `npm test` passes.
- [ ] Specific tests pass:
  - [ ] `loadEnv` returns a typed `Env` object when given a valid source.
  - [ ] `loadEnv` throws `EnvValidationError` listing every missing required
        field, when given an empty source.
  - [ ] `loadEnv` throws when `ENCRYPTION_KEY` is the wrong length or not hex.
  - [ ] `loadEnv` throws when `AI_SERVICE_URL` is set but `AI_SERVICE_API_KEY`
        is not (and vice versa).
  - [ ] `loadEnv` applies defaults for `NODE_ENV`, `PORT`, `LOG_LEVEL`,
        `APP_NAME`, `APP_VERSION`, `SHOPIFY_AUTH_CALLBACK_PATH`.
  - [ ] Importing `env` does not throw at import time when the source is
        invalid; throws on first property access.
  - [ ] All keys appearing in `.env.example` are present in the schema, and
        vice versa (a meta-test compares the two).

## Files touched

- `src/config/env.ts` (rewritten)
- `src/config/env.test.ts` (new)
- `.env.example` (refreshed)
- `vitest.config.ts` (new)
- `package.json` (no change in this milestone — already touched in boot-phase
  repair)

## Open questions

- **Lint config does not yet exist.** ESLint is a dev dep but no
  `eslint.config.js`/`.eslintrc` is present, so `npm run lint` will fail.
  Decision: M-001 considers lint optional. M-012 is the milestone that wires
  ESLint properly. Until then, a missing lint config is not a blocker. The
  session log will note this.
- **TypeScript path aliases.** `tsconfig.json` defines `@config/*`, etc. The
  test runner needs to resolve these. Decision: configure
  `vite-tsconfig-paths` in `vitest.config.ts` so tests inherit the same
  aliases.
- **`tests` directory excluded in tsconfig.** Tests are colocated as
  `*.test.ts` next to source, so this is fine.

## ADRs created or referenced

None. This milestone implements established conventions; no new
cross-cutting decision is required.
