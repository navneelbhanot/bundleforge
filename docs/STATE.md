# STATE.md — Live Project State

> Single source of truth for "what's next." Updated at the end of every
> session, in the same commit as the work. If this file disagrees with the
> code, the next session's first job is to reconcile.

---

## Current milestone

**M-001 — Environment validation and secrets bootstrap**

Status: `pending`
Spec: not yet written. M-001 is small enough to spec inline at session start,
or you may write `docs/specs/M-001-env-bootstrap.md` first.

## Exact next action

Open the next session, run the boot phase from `CLAUDE.md` §3.1, then:

1. Write `docs/specs/M-001-env-bootstrap.md` covering: zod env schema, refresh
   of `.env.example`, `src/config/env.ts` rewritten to validate at boot, unit
   tests, and acceptance criteria.
2. Implement per the spec.
3. Close per `CLAUDE.md` §3.3.

## Blockers

None.

## Open questions for the user

- Hosting target: Render, Fly, Railway, or self-managed? Affects the runbook
  and Dockerfile but does not block M-001. Defer until M-014.
- Sentry + Datadog accounts: not needed until M-015. Flag at that time.
- Shopify Partner App + API keys: needed by M-016. Flag at that time.

## Recently completed

- M-000 — Bootstrap planning system. See `docs/sessions/0000-bootstrap-planning-system.md`.

## Working branch

`claude/review-product-plan-jfMlf`
