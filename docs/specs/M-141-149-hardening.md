# M-141..M-149 — Hardening

Hardening sweep covering accessibility, observability, ops procedures,
GDPR endpoints, rate limit tightening, and API documentation.

## M-141 Accessibility (WCAG AA)

- Install `eslint-plugin-jsx-a11y` for the frontend.
- Add `vitest-axe` integration: smoke-test every page component for
  axe violations.
- Polaris is WCAG AA out of the box; we mostly need a regression net.

## M-142 Sentry coverage audit

- Verify every `errorHandler` 5xx path calls `captureError`.
- Verify every async worker handler logs `{ err }` and (where
  appropriate) calls `captureException`.
- Document the audit in `docs/runbook.md`.

## M-143 Datadog dashboards

- `monitoring/datadog/dashboards/*.json` describe queue depth,
  webhook lag, sync duration, and HTTP latency dashboards.
- `monitoring/datadog/README.md` explains how to import them.

## M-144 Incident response runbook

- New `docs/runbook-incidents.md` — alert routing, on-call rotation
  template, common-issue playbook (DB outage, Redis outage, queue
  backed up, Shopify rate limit exhaustion).

## M-145 Backup + restore drill

- `scripts/backup.sh` (logical pg_dump) + `scripts/restore.sh` (psql
  restore).
- Drill procedure documented in the runbook.

## M-146 GDPR data export endpoint

- `POST /api/v1/gdpr/export` (admin-only, `req.shopId`-scoped). Returns
  JSON containing the shop's bundles, orders, audit log, and
  integrations metadata (creds redacted).

## M-147 GDPR data deletion endpoint

- `POST /api/v1/gdpr/delete-shop`. Hard-deletes the shop row;
  cascades through FK. Mirrors the M-030 webhook handler but is
  initiated by the merchant via the admin.

## M-148 Rate limit hardening + abuse tests

- Per-IP secondary limiter on `/api/auth` and `/api/webhooks` (the
  routes that don't have a shop session yet).
- Abuse property test that hammers `/health` with too-many requests
  and asserts 429.

## M-149 OpenAPI documentation

- `docs/openapi.yaml` lists every public endpoint with its request /
  response schema.
- `npm run docs:openapi` validates the file with a tiny check (parses
  JSON+lints headers).

## Files

- `src/routes/gdpr.ts` (+ test)
- `src/routes/gdpr.test.ts`
- `frontend/eslint a11y plugin install`
- `frontend/src/__a11y__/pages.test.tsx`
- `monitoring/datadog/{queue,webhook,sync,http}.json`
- `monitoring/datadog/README.md`
- `docs/runbook-incidents.md`
- `scripts/backup.sh`, `scripts/restore.sh`
- `docs/openapi.yaml`
