# CLAUDE.md — MintBundle Session Protocol

> Read this file in full at the start of every session. It is the operating
> manual for any Claude Code session working on this repo.

---

## 1. What this project is

MintBundle is a Shopify product bundling app being built end-to-end by Claude
Code in **sequential, single-threaded sessions**. There is no human team writing
code. Every session must therefore be able to pick up exactly where the previous
session left off, with zero ambiguity, by reading the repo.

The product vision is in `PRODUCT_PLAN.md`. The technical architecture is in
`ARCHITECTURE.md`. Neither is edited during normal work — they are read-only
references. All living state lives under `docs/`.

---

## 2. The four files every session reads first

In this exact order, on every session boot:

1. `CLAUDE.md` (this file) — the rules
2. `docs/STATE.md` — the single source of truth for "what's next"
3. `docs/PLAN.md` — the milestone roster + status
4. `docs/sessions/<latest>.md` — what the previous session actually did
5. `docs/specs/<current-milestone>.md` — the spec for the milestone you're about
   to execute (if one exists; if not, your first job is to write it)

If `docs/STATE.md` says the next milestone is `M-007`, you read
`docs/specs/M-007-*.md` before touching code.

---

## 3. Session protocol — boot, work, close

Every session has exactly three phases. Do not skip any.

### 3.1 Boot phase

1. Read the four files above.
2. Run `npm run typecheck`, `npm test`, `npm run lint` (or whatever the runbook
   specifies). If any fails, **your first task is to reconcile** — either fix
   the code or fix the docs so the docs match reality. Do this in a single
   commit before starting new work.
3. Run `git status`. If the tree is dirty, stop and ask the user what to do
   with the uncommitted changes. Never silently discard work.
4. Confirm you understand the milestone's acceptance criteria. If the spec is
   ambiguous, **stop and ask the user** rather than guessing.

### 3.2 Work phase

1. Execute exactly one milestone (or one explicit chunk of a milestone).
2. Touch only files needed for the current milestone. No "while I'm here"
   refactors.
3. Write tests as part of the milestone, not after. A milestone is not done
   without the tests called for in its spec.
4. If you discover the milestone was sized wrong (too big, too ambiguous,
   missing dependency), **stop**. Document the discovery in `docs/STATE.md`,
   propose a re-split in the next session log, and end the session cleanly.
   Do not silently expand scope.
5. If you discover a missing or wrong assumption in `PRODUCT_PLAN.md` or
   `ARCHITECTURE.md`, write an ADR in `docs/decisions/` proposing the change
   and flag it in the session log. Do not edit the source docs without the
   user's approval.

### 3.3 Close phase

In this exact order:

1. Re-run `npm run typecheck`, `npm test`, `npm run lint`. All must pass.
2. Append a new file `docs/sessions/NNNN-<slug>.md` (use the next free number)
   following the template in `docs/sessions/_template.md`. Be specific about
   what was done, what was verified by hand, what tests were added, what was
   deferred and why.
3. Update `docs/PLAN.md`:
   - Flip the milestone's status (`pending` → `in_progress` → `done`).
   - Update the timestamp.
   - If you wrote a new ADR, link it.
4. Update `docs/STATE.md`:
   - Set `current_milestone` to the next milestone.
   - Write the **exact next action** as a single sentence, e.g. "Run
     `npx prisma migrate dev --name init`, then implement
     `src/services/billing/index.ts` per spec M-031."
   - List any new blockers or open questions.
5. Stage everything with `git add` (specific files, never `-A`).
6. Commit with a structured message: `M-007: webhook HMAC verifier complete`.
   Include a brief body if the change has subtleties.
7. Push to the working branch `claude/review-product-plan-jfMlf` (or whatever
   branch the user has specified).

If any of these steps fail, fix the failure before ending the session. Never
end with a dirty tree, failing tests, or out-of-sync docs.

---

## 4. Milestone sizing rules

A milestone must satisfy **all** of these:

- Fits in one session (≈2–6 hours of focused work, ≈200–800 lines of code).
- Has a written spec in `docs/specs/M-NNN-*.md` before code is written.
- Has explicit, testable acceptance criteria.
- Is independently mergeable: typecheck + lint + tests stay green at the end.
- Doesn't span unrelated areas. "Implement bundles AND inventory" is two
  milestones, not one.
- Has zero ambiguity about "done." "Mostly works" is not done.

If a milestone in `docs/PLAN.md` violates these rules, your first task is to
split it before starting.

---

## 5. Repo conventions

### Stack (from ARCHITECTURE.md §1)

- Node.js 20 LTS + TypeScript 5
- Express + `@shopify/shopify-app-express`
- React 18 + Polaris 12 (frontend)
- Prisma 5 + PostgreSQL 16
- Redis 7 + BullMQ
- Shopify Functions for Cart Transform (JS/Wasm)
- Theme App Extensions (Liquid + Web Components)
- Vitest (unit + integration), Playwright (E2E)
- Pino for logging, Sentry for errors, Datadog for metrics

### Code style

- TypeScript strict mode. No `any` without a `// eslint-disable` and a comment
  explaining why.
- Prefer pure functions for business logic (pricing, SKU breakdown, stock
  recompute). Side effects at the edges.
- Money: use `Decimal` from Prisma or `dinero.js` — never `number`.
- Validate all external input (HTTP body, webhook payload, env) with Zod.
- Database access goes through repository functions in
  `src/services/<domain>/repository.ts`, not from routes directly.
- One file per significant exported symbol. Index files re-export.
- Tests live next to source as `*.test.ts` or in `tests/` for integration/E2E.

### Database

- Every migration is reviewed before applying. Use
  `npx prisma migrate dev --name <descriptive>` in dev, never `db push`.
- The `inventory_audit_log` table has `REVOKE UPDATE, DELETE` applied at the
  database level. See ADR 0003.
- Multi-tenant queries always filter by `shop_id` first. Never trust input
  to do this.

### Shopify-specific

- Every webhook payload is HMAC-verified before being trusted.
- Every inbound API call goes through session middleware that loads the `Shop`
  by domain.
- Every Shopify Admin API call is wrapped in a typed client; raw `fetch` calls
  to `*.myshopify.com` are forbidden outside the client.
- Cart Transform Function and the Node pricing engine **must share a contract**
  — see ADR 0002 and `docs/specs/M-039-pricing-engine.md`.

### Documentation rules

- ADRs in `docs/decisions/` are append-only after acceptance. To reverse one,
  write a new ADR that supersedes it.
- Specs in `docs/specs/` may be edited as understanding evolves, but any
  meaningful change is logged in the next session log.
- Session logs in `docs/sessions/` are append-only — never edit a past log.
- `PLAN.md` and `STATE.md` change every session that ships work, in the
  same commit as the work.

---

## 6. What Claude Code may not do

- **Never** edit `PRODUCT_PLAN.md` or `ARCHITECTURE.md` without an ADR + user
  approval.
- **Never** edit a past session log.
- **Never** mark a milestone `done` without passing tests for its acceptance
  criteria.
- **Never** silently rescope a milestone.
- **Never** commit secrets. `.env` is gitignored; use `.env.example` for
  documentation.
- **Never** use `git add -A` or `git add .` — stage specific files.
- **Never** force-push, reset --hard, or rewrite history without explicit
  user instruction.
- **Never** run destructive Shopify mutations (delete products, drain
  inventory) outside a dev store.
- **Never** invoke a Shopify API without first checking the version pinned
  in `shopify.app.toml`.
- **Never** assume a Shopify API still works the way you remember — verify
  against `shopify.dev` if the call is unfamiliar or the build breaks.

---

## 7. Trust but verify

Each session inherits the previous session's claims. Treat them as claims, not
facts. The boot-phase test run is the verification step. If a previous session
claimed M-005 was done but `npm test` fails on M-005's tests, your job is to
fix the gap and update the docs in the same commit, before moving on.

This is the single most important rule. Drift between docs and code is the
failure mode that destroys long sequential builds.

---

## 8. Asking the user

You may ask the user when:

- A spec is ambiguous in a way that affects implementation.
- A milestone needs to be re-split.
- A blocker requires their action (Shopify Partner Dashboard, infra, secrets,
  payment).
- An ADR-level decision needs sign-off before implementation.
- You discover that a previous session's claim is wrong and the fix is
  non-trivial.

Do not ask the user to choose between equivalent technical options where you
can pick one and write an ADR. Make the call, document it, move on.

---

## 9. End-of-session summary to the user

After committing and pushing, give the user a short message:

- What milestone was completed.
- What tests were added.
- Anything they need to do (set a secret, click through OAuth on a dev store,
  approve an ADR).
- What the next session will start with (mirror `STATE.md`).

Keep it under 10 lines unless something needs flagging.
