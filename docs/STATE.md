# STATE.md — Live Project State

> Updated at the end of every session, in the same commit as the work.

---

## Current milestone

**Post-M-155 — competitive-audit gap closures.**

The five priorities from the 2026-05-06 competitive audit are now
landed: Cart Transform reads `bundleforge.is_bundle` /
`bundleforge.components` metafields and emits `expand` operations,
publish() writes those metafields, AI suggestions surface as a
first-class admin page, M-100 visual builder covers all 13 bundle
types, i18n ships in 15 locales, and the trust-story doc is live.
See `docs/sessions/0160-competitive-audit-closures.md`.

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

- **Real Shopify product sync on publish()** — DONE 2026-05-06.
  publish() now calls productCreate via `defaultCreateShopifyProduct`
  in `src/routes/bundles.ts` and persists the GID + legacy id, with a
  components JSON metafield the Cart Transform reads at checkout.
- **POS integration** — once a Shopify product exists per bundle (now
  true), publish to the POS sales channel via `productPublish` + the
  POS publication ID. Code change is small; deferred until a beta
  merchant actually uses POS.
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
  Step-by-step in `docs/runbook-railway.md`.
- POS sales-channel publication blocked by the publish()-creates-
  Shopify-product gap. Documented in Future code work below.

## Carry-overs (still active)

- Cloudflare WAF rule for HMAC abuse — referenced in
  `docs/runbook-incidents.md`; ops provisions when the domain goes
  behind Cloudflare.

## Recently completed

- **Competitive-audit gap closures** (2026-05-06 late). Cart Transform
  Function now reads `bundleforge.is_bundle` and
  `bundleforge.components` product metafields and emits an `expand`
  operation that swaps a bundle product line for one line per
  component variant. publish() in `src/services/bundles/index.ts`
  passes items + pricing rules through to the Shopify productCreate
  hook so `defaultCreateShopifyProduct` writes the components JSON
  metafield (schemaVersion 1). New `AiSuggestionsPage` admin page
  consumes `/api/v1/ai/suggested-bundles` and pre-fills the create
  flow with the AI-recommended SKU pair. M-100 TypeConfigPanel now
  has dedicated read-only display for all 13 bundle types (8 added:
  bogo, bxgy, volume, gift, mystery, sample, subscription, custom).
  i18n ships 9 new locales (ja, zh, ko, nl, pl, sv, da, no, ru) for
  15 total. `docs/help/why-bundleforge.md` published as the trust
  story for the App Store listing.
- **Visual UI revamp + sidebar nav fix** (2026-05-06 evening).
  Card-grid bundle type picker with gradient banners (distinct from
  competitor product-photo aesthetic); fresh-shop dashboard centered
  on three differentiator cards (atomic inventory / pricing parity /
  immutable audit log) instead of a generic onboarding checklist;
  stat cards above the bundles table when populated. NavMenu
  switched from React Router `<Link>` to plain `<a>` so App Bridge
  click interception works and the outer admin URL stays in sync.
  6/6 Playwright now (split the wizard test).
  `docs/sessions/0159-ui-revamp-navmenu-typecards.md`.
- **Crisp live chat + Storefront API endpoint + Bundle CRUD e2e test
  + Railway runbook** (2026-05-06 PM). Wired Crisp via env-driven
  meta-tag substitution + lazy loader; added `/api/storefront/v1/`
  public read-only routes for Hydrogen / headless storefronts;
  added a real Postgres-backed Bundle CRUD integration test that
  drives create → list → detail → update → publish → archive plus
  cross-tenant safety; documented Railway worker + AI Service start-
  command fixes in `docs/runbook-railway.md`. Demoted POS in §4 to
  await the publish-creates-Shopify-product gap (separate larger
  task — see Future code work below).
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

- **467 / 467 vitest tests passing** when DATABASE_URL points at a
  real Postgres (CI + dev with `bundleforge_e2e` DB). +5 cart-transform
  expand-path tests, +8 TypeConfigPanel coverage tests since 0159.
- **454 / 454** when no real DB is available — the bundle CRUD
  integration tests auto-skip via `describe.skipIf`.
- **5 / 5 Playwright e2e tests passing** (unchanged from 0159).
- CI runs both layers on every push and PR (`.github/workflows/ci.yml`,
  jobs `test` + `e2e`).
- Typecheck clean (server + frontend).
- Lint: 5 pre-existing errors (NavMenu namespace + scripts using
  require) and 14 warnings; no new violations introduced this session.

## Working branch

`claude/objective-sinoussi-77ae86` (today's worktree). Main is
fast-forwarded through every commit; CI runs against main.
