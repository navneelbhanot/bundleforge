# Session 0025 — Webhook dispatcher to BullMQ

- **Date:** 2026-05-04
- **Milestone(s):** M-025

## What was done

- Wrote `docs/specs/M-025-webhook-dispatcher.md`.
- `src/jobs/queues.ts`: added `WEBHOOKS_QUEUE` constant + `webhooksQueue`
  Queue instance.
- `src/webhooks/index.ts` (rewritten): `mountWebhooks(app, opts?)`
  registers POST /api/webhooks. Verifies HMAC (M-024 middleware), then
  enqueues `{topic, shopDomain, webhookId, payload}` with name = topic
  and jobId = webhookId (so Shopify retries dedupe naturally). Always
  responds 200.
- `src/server/index.ts`: mount mountWebhooks(app).
- 2 supertest cases: enqueues on valid HMAC; 401 + no enqueue on invalid.

## Acceptance

- [x] All criteria pass; 113 tests.

## Surprises

- The verifier reads `env.SHOPIFY_API_SECRET`, which is fixed at first
  Proxy access. Test secrets must flow through `opts.secret` rather than
  mutating `process.env` after import.

## Handoff

Next: **M-026 — Webhook handler `app/uninstalled`**. Worker that consumes
the `app/uninstalled` job from the webhooks queue, sets
`Shop.uninstalledAt`, and drains future jobs for that shop. Tests use a
fake worker invocation with a Prisma stub.
