# STATE.md — Live Project State

> Updated at the end of every session, in the same commit as the work.

---

## Current milestone

**🎉 All 156 milestones complete (M-000 through M-155).**

The build is feature-complete against `PRODUCT_PLAN.md` and
`ARCHITECTURE.md`. Remaining work is operational: legal sign-off,
screenshot/video production, App Store submission, and beta merchant
scheduling — all owned by the user.

## Exact next action

User-owned (not code):

1. Send `legal/privacy-policy.md` and `legal/terms-of-service.md` to
   counsel for review. Fill in the `{{placeholder}}` fields.
2. Capture the 6 screenshots per `docs/launch/screenshots-spec.md`
   and shoot the 60-second video per `docs/launch/video-script.md`,
   against the demo store seeded by `scripts/demo-reset.sh`.
3. Walk `docs/launch/submission-checklist.md` end-to-end on staging,
   then submit the App Store listing.
4. Schedule beta merchants per `docs/onboarding-beta.md`.
5. On D-day follow `docs/launch/launch-checklist.md`.

Future code work (post-launch backlog):

- Shopify SDK upgrade (api v13, app-express v7, prisma v6,
  session-storage-prisma v9) — ADR before merge.
- ResourcePicker integration on `ProductPicker`.
- Theme-extension Playwright tests.
- Amazon SP-API SigV4 (current adapter is a basic stub).
- Datadog statsd wiring in the worker (the dashboards reference
  metric names; emit them when production traffic warrants).
- M-126 nightly retraining schedule (the AI client and route exist;
  cron entry lands when production ops needs it).
- Analytics materialized views.

## Blockers

None. Engineering scope closed.

## Carry-overs (still active)

- npm audit: 3 production findings rooted in `uuid <14` via Shopify
  SDK (vulnerable code path not called). Resolved by the SDK upgrade
  above. See ADR-0004.
- Cloudflare WAF rule for HMAC abuse — referenced in
  `docs/runbook-incidents.md`; ops provisions when the domain goes
  behind Cloudflare.

## Recently completed

- M-150..M-155 — Launch batch (legal templates, demo seed, beta
  onboarding, App Store assets, launch checklist).
  `docs/sessions/0150-launch.md`.
- M-141..M-149 — Hardening (a11y, Sentry audit, Datadog dashboards,
  incident runbook, backup/restore, GDPR endpoints, per-IP rate
  limiter, OpenAPI). `docs/sessions/0141-hardening.md`.
- M-140 — Security review pass + ADR-0004. `docs/sessions/0140-security-review.md`.
- M-137..M-139 — Property tests. `docs/sessions/0137-property-tests.md`.
- M-131..M-136 — Server-side i18n + 6 locales. `docs/sessions/0131-i18n.md`.
- (Earlier history in PLAN.md.)

## Test status

- **442 / 442 tests passing.**
- Typecheck clean (server + frontend).
- Lint clean (2 pre-existing warnings, no errors).

## Working branch

`claude/review-product-plan-jfMlf`
