# Public launch checklist — D-7 → D+1 (M-155)

Final timeline. Owners are roles, not people; assign before D-7.

## D-7 — Infrastructure freeze

- [ ] **Eng**: feature freeze on `main`. Only critical bug fixes from
      here.
- [ ] **Eng**: scale prod to launch capacity (4× steady-state).
- [ ] **Eng**: confirm Postgres has 2× headroom in CPU + IOPS.
- [ ] **Eng**: confirm Redis cluster has 2× memory headroom.
- [ ] **Eng**: scheduled `pg_dump` runs hourly to S3; retention 7 days.
      Drill once.
- [ ] **Ops**: PagerDuty schedule confirmed for launch week, 24/7
      primary + secondary.
- [ ] **Ops**: Datadog monitors armed (`monitoring/datadog/README.md`
      → "Alerting" table).

## D-5 — Submission + comms drafts

- [ ] **Founder**: submit to Shopify App Store with the
      `submission-checklist.md` attached.
- [ ] **Marketing**: blog post draft ready for review.
- [ ] **Marketing**: launch tweet thread + LinkedIn post drafted.
- [ ] **Marketing**: ProductHunt page drafted (private).
- [ ] **Support**: canned-response library populated for top-10
      anticipated questions.

## D-3 — Beta wrap

- [ ] **Eng + Support**: every beta merchant resolved or actively in
      conversation. No open sev1.
- [ ] **Eng**: load test the prod stack at 5× steady-state for 30 min.
      Record baseline P95 latency and queue depth.

## D-1 — Final pre-flight

- [ ] **Eng**: smoke-test fresh OAuth + first-bundle flow on a clean
      dev store.
- [ ] **Eng**: mandatory webhooks return 200 in <5 s — verified live.
- [ ] **Eng**: backup-restore drill repeated; RTO < 30 min recorded.
- [ ] **Founder**: confirm App Store review passed (or expected pass
      window).
- [ ] **Founder**: status page live at `status.mintbundle.app`.

## D-day (launch) — runbook

- [ ] **08:00 local**: confirm App Store listing live. Pull the install
      URL.
- [ ] **08:15**: post launch announcement (blog, Twitter/X, LinkedIn,
      ProductHunt).
- [ ] **08:30**: enable in-app banner on dev/staging deployments
      pointing to the public URL.
- [ ] **09:00**: open #launch slack bridge with eng, support, and
      founder. Hourly check-ins.
- [ ] **All day**: monitor Datadog HTTP + queue dashboards. Auto-page
      thresholds active.
- [ ] **All day**: support manning the inbox; SLA <2h.
- [ ] **17:00**: end-of-day retrospective in #launch — counts:
      installs, churn, errors, support volume.

## D+1 — Stabilise

- [ ] **Eng**: review Sentry top-10 issues from D-day. Patch or
      backlog.
- [ ] **Ops**: confirm capacity headroom; adjust if installs >2× plan.
- [ ] **Marketing**: thank-you email to D-day installers.
- [ ] **Founder**: post-launch retro doc in `docs/incidents/` if any
      sev2+ occurred. Otherwise a brief retro in Slack.

## Rollback plan

If a critical issue surfaces during launch:

1. **Founder**: pull the App Store listing to "draft" — stops new
   installs while the app stays live for existing merchants.
2. **Eng**: identify scope (all merchants, plan-tier, region, theme
   version).
3. **Eng**: deploy a fix from a hotfix branch, OR set a feature flag
   in `Shop.settings` to disable the bad code path globally.
4. **Marketing**: post a status-page incident; tweet "we're aware,
   investigating, ETA Xm."
5. **Founder**: when resolved, re-publish listing + post-mortem within
   24 h.
