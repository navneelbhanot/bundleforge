# M-025 — Webhook dispatcher to BullMQ

## Goal

Mount `/api/webhooks` to verify HMAC, enqueue the payload to a BullMQ
`webhooks` queue keyed by topic, and respond 200 within Shopify's
required window.

## Why

Shopify retries any webhook that doesn't get a 2xx within 5 seconds.
Doing all the work synchronously risks timeouts. The dispatcher is the
fast path; handlers (M-026+) consume from BullMQ.

## Design

```ts
// src/jobs/queues.ts — add WEBHOOKS_QUEUE + webhooksQueue
// src/webhooks/index.ts — replace stub with mountWebhooks(app, opts?)
//   that POST handles /api/webhooks (HMAC verifier + dispatch)
```

`opts.queue?: BullMQ.Queue` is DI for tests.

Job shape:

```ts
{
  name: <topic>,
  data: {
    topic: string,
    shopDomain: string,
    webhookId: string,
    payload: unknown,
  }
}
```

The dispatcher uses `webhookId` as `jobId` for natural deduplication
across Shopify retries.

## Acceptance criteria

- [ ] POST /api/webhooks with valid HMAC enqueues to webhooksQueue and
      returns 200 in <100ms (modulo queue latency).
- [ ] POST with invalid HMAC returns 401 (provided by M-024).
- [ ] Job name == topic; jobId == webhookId (dedup).
- [ ] Tests use a fake queue.

## Files touched

- `src/jobs/queues.ts` (add WEBHOOKS_QUEUE)
- `src/webhooks/index.ts` (rewrite)
- `src/webhooks/dispatcher.test.ts` (new)
- `src/server/index.ts` (mount)
- `src/jobs/worker.ts` (add webhooksWorker stub)
