# M-028 — GDPR webhook: customers/data_request

## Goal

Acknowledge Shopify's mandatory `customers/data_request` webhook. Since
BundleForge does not store any customer PII, the handler logs receipt
and returns. Required for App Store approval.

## Acceptance

- [ ] Handler logs payload metadata (shopId, customer id) via Pino.
- [ ] Returns without throwing.
- [ ] Registered in webhooksWorker.
- [ ] One unit test.

## Files

- `src/webhooks/handlers/customersDataRequest.ts`
- `src/webhooks/handlers/customersDataRequest.test.ts`
- `src/jobs/webhooksWorker.ts` (register)
