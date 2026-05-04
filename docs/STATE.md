# STATE.md — Live Project State

> Single source of truth for "what's next." Updated at the end of every
> session, in the same commit as the work. If this file disagrees with the
> code, the next session's first job is to reconcile.

---

## Current milestone

**M-002 — Encryption utility (AES-256-GCM) + tests**

Status: `pending`
Spec: not yet written. Write `docs/specs/M-002-encryption.md` at session
start, before code.

## Exact next action

Open the next session, run the boot phase from `CLAUDE.md` §3.1, then:

1. Write `docs/specs/M-002-encryption.md` covering: AES-256-GCM helper at
   `src/utils/encryption.ts` with `encrypt(plaintext)` / `decrypt(payload)`,
   key sourced from `env.ENCRYPTION_KEY`, IV per encryption, auth tag
   verification, base64url payload format, and key-rotation hook stub.
   Include unit tests for round-trip, tampering detection, key mismatch.
2. Implement per the spec.
3. Close per `CLAUDE.md` §3.3.

The existing `src/utils/encryption.ts` (if any) should be reviewed; replace
or wrap depending on its current state.

## Blockers

None.

## Open questions for the user

- Hosting target (Render / Fly / Railway / self-managed): unchanged from
  M-001 — defer until M-014.
- Sentry account: unchanged — needed at M-015.
- Shopify Partner App + API keys: unchanged — needed at M-016.

## Carry-overs from M-001 (deferred work)

These are tracked here so future sessions don't lose them. They are NOT
blockers for M-002.

1. **Pre-existing stubs excluded from typecheck.** `src/server/index.ts`,
   `src/services/bundles/index.ts`, and `src/routes/bundles.ts` are listed
   in `tsconfig.json`'s `exclude` block. They contain "vibe-coded" stubs
   with deeper Prisma typing issues that would require non-trivial fixes.
   Their replacement milestones (M-006, M-049, M-053) must remove them
   from the exclude list as part of acceptance criteria.
2. **Lint deferred.** `npm run lint` is currently a no-op message until
   M-012 wires ESLint v9 flat config. The real command is preserved as
   `npm run lint:real`.
3. **`@shopify/app` package removed; `@shopify/cli` bumped to ^3.94.0;
   `@shopify/shopify-app-session-storage-prisma` bumped to ^5.0.0.** These
   were the smallest changes needed to unblock `npm install`. A broader
   Shopify SDK upgrade (api v13, app-express v7, session-storage-prisma v9,
   prisma v6) may be revisited closer to M-016 — capture in an ADR if so.
4. **`npm audit` reports 11 moderate vulnerabilities.** Deferred to M-140
   (security review pass).
5. **`tsconfig.json` no longer includes `prisma/**/*`.** `prisma/seed.ts`
   is run via ts-node and does not need to participate in the main tsc
   build. M-010 (seed script) verifies seed compiles cleanly under ts-node.

## Recently completed

- **M-001** — Environment validation and secrets bootstrap. See
  `docs/sessions/0001-env-bootstrap.md`.
- **M-000** — Bootstrap planning system. See
  `docs/sessions/0000-bootstrap-planning-system.md`.

## Working branch

`claude/review-product-plan-jfMlf`
