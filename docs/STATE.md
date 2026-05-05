# STATE.md — Live Project State

> Updated at the end of every session, in the same commit as the work.

---

## Current milestone

**Post-M-155 — operational hardening from first real install.**

The 156 planned milestones are still complete in the sense that all
their code lives in the repo and the unit tests pass. Today's session
exposed that *no prior milestone had ever been exercised end-to-end
through a real Shopify install*; many integration-shaped bugs were
masked by mock-only tests. The build now actually installs on a real
dev store and the embedded admin loads. See
`docs/sessions/0157-first-install-deploy-fixes.md`.

## Exact next action

Mixed code + user-owned. In rough order:

1. **User**: confirm in the Shopify admin that bundle CRUD works
   end-to-end on `devstore-2u6u4fcc.myshopify.com` — create, edit,
   publish, archive. Today only verified install + create-form mount.
2. **User (Railway dashboard)**: fix the worker service
   (`outstanding-nourishment`) — its `startCommand` is
   `npm run start:web`; it should be `npm run start:worker`. Same for
   the `AI Service` (currently FAILED with the wrong start command).
3. **Code**: write the OAuth-flow Playwright test if/when the
   worker/AI surface fixes uncover anything new — the existing
   `tests/integration/auth-flow.test.ts` covers middleware logic but
   not the actual OAuth redirect chain.
4. **User decision**: whether to commission a real competitive
   comparison (replace the speculative table in `PRODUCT_PLAN.md`
   §4 with measured data from each top competitor).

Operational, still user-owned (unchanged from before today):

- Send `legal/privacy-policy.md` and `legal/terms-of-service.md` to
  counsel; fill in `{{placeholder}}` fields.
- Capture screenshots per `docs/launch/screenshots-spec.md`, shoot
  the video per `docs/launch/video-script.md`.
- Walk `docs/launch/submission-checklist.md` end-to-end on the dev
  store, then submit.
- Schedule beta merchants per `docs/onboarding-beta.md`.
- On D-day follow `docs/launch/launch-checklist.md`.

Future code work (post-launch backlog):

- **Live chat integration** (Crisp / Intercom / Tidio) — needed to
  back the §5 "Support quality" pain-point claim. Pick a provider
  and ship the embed; staffing is operational. New roadmap item per
  the 2026-05-06 audit.
- **Hydrogen / Storefront API surface** — currently marked
  `(roadmap)` in `PRODUCT_PLAN.md` §4. Needs a real engineering
  pass; pricing engine is already runtime-agnostic so the work is
  plumbing.
- **POS integration** — only `read_locations` scope declared; needs
  an actual POS adapter to back the §4 claim.
- **Trial-warning emails** — needed to back the §5 "Billing
  transparency" claim. Needs SMTP wiring + a cron worker job.
- **Prisma v6 → v7** — requires `prisma.config.ts` + adapter rewiring.
  Not blocking launch.
- ResourcePicker integration on `ProductPicker`.
- Theme-extension Playwright tests.
- Amazon SP-API SigV4 (current adapter is a basic stub).
- Datadog statsd wiring in the worker (dashboards reference metric
  names; emit them when production traffic warrants).
- M-126 nightly retraining schedule (AI client + route exist; cron
  entry lands when production ops needs it).
- Analytics materialized views.

## Blockers

- Worker + AI services on Railway have wrong `startCommand`; user must
  fix in the dashboard (CLI cannot edit service-stored startCommand).

## Carry-overs (still active)

- Cloudflare WAF rule for HMAC abuse — referenced in
  `docs/runbook-incidents.md`; ops provisions when the domain goes
  behind Cloudflare.

## Recently completed

- **PRODUCT_PLAN audit + UI polish + null-safe pages + OnboardingWizard
  wiring + merchant help docs** (2026-05-06). Replaced the bare
  `<Link>` nav with Polaris Tabs; added EmptyState renders to all
  list pages with shape-tolerance against API drift; wired the
  built-but-unused OnboardingWizard into BundlesListPage; demoted
  three vapor claims (POS, Hydrogen, live chat) in PRODUCT_PLAN §4
  to `(roadmap)`; published `docs/help/` (7 files) for merchants.
- **First real Shopify dev-store install + 14 deploy/auth/UI fixes +
  3 new test layers + CI e2e job** (2026-05-05). 17 commits.
  `docs/sessions/0157-first-install-deploy-fixes.md`.
- Railway deploy config + Shopify SDK / Prisma 6 major upgrade +
  `tsx` runtime (ADR-0005). `docs/sessions/0156-railway-and-sdk-upgrade.md`.
- M-150..M-155 — Launch batch (legal templates, demo seed, beta
  onboarding, App Store assets, launch checklist).
  `docs/sessions/0150-launch.md`.
- M-141..M-149 — Hardening (a11y, Sentry audit, Datadog dashboards,
  incident runbook, backup/restore, GDPR endpoints, per-IP rate
  limiter, OpenAPI). `docs/sessions/0141-hardening.md`.
- M-140 — Security review pass + ADR-0004. `docs/sessions/0140-security-review.md`.
- (Earlier history in PLAN.md.)

## Test status

- **454 / 454 vitest tests passing** (442 prior + 9 SPA-headers
  integration + 3 auth-flow integration).
- **5 / 5 Playwright e2e tests passing** (Polaris CSS, authFetch JWT,
  OnboardingWizard fresh-shop walkthrough, /bundles/new mount, route
  registration).
- CI runs both layers on every push and PR (`.github/workflows/ci.yml`,
  jobs `test` + `e2e`).
- Typecheck clean (server + frontend).
- Lint clean (2 pre-existing warnings, no errors).

## Working branch

`claude/objective-sinoussi-77ae86` (today's worktree). Main is
fast-forwarded through every commit; CI runs against main.
