# Session 0023 — REST Admin API client wrapper

- **Date:** 2026-05-04
- **Milestone(s):** M-023

## What was done

- New `src/shopify/rest.ts`: `shopifyRest<T>(session, args, opts?)` wraps
  the SDK's REST client with one retry on 429 and Pino logging. DI-friendly.
- 4 unit tests: 200 happy path, 429-then-200 retry, 429+429 failure,
  non-429 4xx no-retry.

## Acceptance

- [x] Spec criteria pass; 107 tests.

## Handoff

Next: **M-024 — Webhook HMAC verifier middleware**. Required for every
inbound webhook from Shopify. The SDK provides `validateHmac` helpers;
wrap them as Express middleware preserving raw body for signature
verification.
