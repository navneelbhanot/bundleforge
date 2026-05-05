# Session 0027 — shop/update handler

- **Date:** 2026-05-04
- **Milestone(s):** M-027

## What was done

- `src/webhooks/handlers/shopUpdate.ts`: maps Shopify webhook payload
  fields (name/email/currency/iana_timezone/plan_name/primary_locale)
  onto Shop columns. Strict allowlist + type checks; ignores other fields.
- 3 tests: full mapping, no-op when payload empty, type guards filter
  bad values.
- Registered in `src/jobs/webhooksWorker.ts`.

## Acceptance

- [x] All criteria; 118 tests.

## Handoff

Next: **M-028 — customers/data_request**. Mandatory GDPR webhook. We
don't store customer PII in this app, so the handler logs receipt and
acks. Same pattern: handler + 1 test + register.
