# ADR 0005 — Shopify SDK + Prisma major upgrade, tsx runtime

- **Status:** accepted
- **Date:** 2026-05-05
- **Supersedes part of:** the M-001 carry-over noted in STATE.md

## Context

BundleForge shipped on:
- `@shopify/shopify-api` ^11
- `@shopify/shopify-app-express` ^5
- `@shopify/shopify-app-session-storage-prisma` ^5
- `@prisma/client` ^5 + `prisma` ^5
- `tsc` emitting CJS to `dist/` for production runtime

This was carried as residual risk in ADR-0004 (security review) — the
underlying `uuid <14` vulnerability in the Shopify SDK is fixed in v13,
and Shopify support for v11 wound down ahead of App Store reviewer
expectations.

## Decision

Bump the four packages to current majors:
- `@shopify/shopify-api` → ^13
- `@shopify/shopify-app-express` → ^7
- `@shopify/shopify-app-session-storage-prisma` → ^9
- `@prisma/client` + `prisma` + `@prisma/adapter-pg` → ^6.19 (latest 6.x)

We **did not** bump Prisma to v7. Prisma v7 removes `url` from
`schema.prisma` and requires a `prisma.config.ts` with an explicit
adapter, plus a different PrismaClient construction pattern. That's a
separate, larger refactor and not required for the launch.

We **also** moved the production runtime from `tsc → node dist/...` to
`tsx src/...` directly. Reasons:

1. Shopify SDK v13 publishes both source `.ts` and compiled `.d.ts` /
   `.js` files inside `node_modules/@shopify/shopify-api/`. With legacy
   `moduleResolution: "node"`, tsc resolves imports to the source
   `.ts`, which has type errors that escape `skipLibCheck` (it only
   skips `.d.ts`). Running our own `tsc` against the SDK fails.
2. Switching to `moduleResolution: "Bundler"` honors the package's
   `exports` field and resolves to the proper `.d.ts`. But Bundler
   resolution requires `module: "ES2022"` (or higher), which makes tsc
   emit ESM. Our runtime + ts-node + vitest are all CJS; mixing them
   needs `"type": "module"` in `package.json`, which breaks
   `require.main === module` and a few other internal patterns.
3. The cleanest exit: keep `module: ES2022` + `moduleResolution:
   Bundler` for **typecheck only** (`tsc --noEmit`), and use `tsx` to
   load TS at runtime in production. `tsx` adds ~1 dep, starts in
   <100 ms, and avoids the dual-config build pipeline.

## Consequences

Positive:
- 8 fewer `npm audit` findings (the SDK upgrade clears the `uuid <14`
  chain).
- We're current with Shopify's supported SDK majors — App Store
  reviewers won't flag this.
- One fewer build artifact to manage (no `dist/src/`).
- `tsx` is hot-reload-friendly for production troubleshooting.

Negative:
- `tsx` adds ~1.5 MB to the production install (acceptable — under the
  Railway image cap by orders of magnitude).
- Slightly slower cold start than pre-compiled JS (~50 ms; negligible
  vs. Postgres + Redis connect time).
- Future Prisma v7 upgrade is still owed, but not blocking launch.

## Alternatives considered

- **Stay on shopify-api v11.** Punts the security remediation; the
  reviewer flag is a separate risk.
- **Patch shopify-api node_modules to remove source `.ts` files.**
  Brittle; breaks on every `npm ci`.
- **Switch to NodeNext resolution.** Requires `.js` extensions on every
  relative import — ~150-file refactor. Rejected.
- **Use SWC or esbuild for the build step.** Adds toolchain complexity
  for a problem `tsx` solves with one dependency.
- **Bump Prisma v7.** Real value but a larger refactor (schema URL +
  adapter wiring). Tracked as post-launch backlog.

## Verification

- `npm test` — 442/442 pass after upgrade (no regressions).
- `npm run typecheck` — clean.
- `npm run lint` — only the 2 pre-existing warnings.
- `npm run build:frontend` — emits `dist/frontend/index.html` + JS bundle.
- `npm run docs:openapi` — clean.
