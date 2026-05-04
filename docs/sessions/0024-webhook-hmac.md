# Session 0024 — Webhook HMAC verifier

- **Date:** 2026-05-04
- **Milestone(s):** M-024

## What was done

- Wrote `docs/specs/M-024-webhook-hmac.md`.
- New `src/middleware/shopifyWebhook.ts`: `shopifyWebhookHmac(opts?)`
  returns `[rawParser, verifier]`. Verifier uses `timingSafeEqual`,
  rejects with `UnauthorizedError`, and on success populates
  `req.shopifyTopic`, `req.shopifyShopDomain`, `req.shopifyWebhookId`,
  `req.shopifyHmacValid`, `req.rawBody`, and parsed `req.body`.
- Augmented Express Request type with optional shopify webhook fields.
- 4 supertest cases: valid HMAC, tampered body, missing header, altered
  signature.

## Acceptance

- [x] All criteria pass; 111 tests.

## Handoff

Next: **M-025 — Webhook dispatcher to BullMQ**. Mount the verifier on
`/api/webhooks` and dispatch each verified webhook to the appropriate
queue based on `X-Shopify-Topic`. Acknowledge 200 quickly; do real work
in workers (M-026+).
