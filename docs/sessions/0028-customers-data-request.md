# Session 0028 — GDPR customers/data_request

- **Date:** 2026-05-04
- **Milestone(s):** M-028

## What was done

- Mandatory GDPR webhook handler. We don't store customer PII so the
  handler logs receipt + ack. Required by Shopify App Store.
- 2 tests confirming non-throw.
- Registered in webhooksWorker.

## Acceptance

- [x] All criteria; 120 tests.

## Handoff

Next: **M-029 — customers/redact**. Same pattern; same outcome (ack);
log warning for any potential follow-up.
