# M-168b — Outbound webhook delivery worker

> Behavior wiring for M-168. The Settings API & webhooks tab
> already lets merchants configure outbound webhook
> subscriptions; M-168b ships the worker that actually
> POSTs to the configured URLs when MintBundle events
> happen.

---

## Why

M-168 added the `OutboundWebhook` table + the CRUD UI but
explicitly deferred the delivery worker. Today saving a
webhook does nothing. M-168b plugs the four event types
(`bundle.published`, `bundle.archived`, `bundle.low_stock`,
`order.dispatched`) into a BullMQ queue + worker that:
- Looks up active subscriptions per event.
- Enqueues one job per (webhook × event).
- Signs the payload with HMAC-SHA256 using the merchant's
  per-webhook secret.
- POSTs to the configured URL with retry/backoff.
- Increments `failCount` on persistent failure and
  auto-disables after 10 consecutive failures.

---

## Scope

### Server

New `src/services/outboundWebhooks/dispatcher.ts`:
- `dispatchOutboundEvent(input: { shopId, event, payload })`.
- Finds enabled webhooks (`disabledAt IS NULL`) subscribed
  to `event`, enqueues one BullMQ job per webhook with
  `{ webhookId, event, payload }`.
- Best-effort: a queue or DB error is logged but never
  bubbles up to the caller. Matches the M-174 activity-log
  pattern.

New `src/jobs/queues.ts` addition:
- `OUTBOUND_WEBHOOKS_QUEUE = "outbound-webhooks"` +
  `outboundWebhooksQueue` exported alongside the existing
  queues.

New `src/jobs/workers/outboundWebhooks.ts`:
- `processOutboundWebhookJob(job, deps)` pure function
  that handles one job: load webhook row, decrypt secret,
  build canonical body (`JSON.stringify(payload)`), compute
  HMAC, POST.
- Failure modes:
  - Network / 5xx → throw, letting BullMQ retry up to 5
    attempts with exponential backoff.
  - 4xx → log, do **not** retry (merchant misconfiguration
    won't fix itself).
  - After all retries fail → increment `failCount`. When
    `failCount >= 10`, set `disabledAt = now()`. Either
    way set `lastFiredAt = now()`.
- `startOutboundWebhookWorker(deps)` factory wires the
  pure function up to a BullMQ Worker bound to the queue.

### Wire emit sites

`BundleService.publish` → `dispatchOutboundEvent({
  shopId, event: "bundle.published", payload: { id, title, slug, type } })`.
`BundleService.archive` → `bundle.archived` similarly.

`bundle.low_stock` and `order.dispatched` are emitted from
inventory + order-dispatch paths but those code paths
already exist (M-070, M-119+); wiring them is a separate
ticket — M-168b focuses on getting the worker live with
the two simplest emit sites.

### Tests

- `src/services/outboundWebhooks/dispatcher.test.ts`
  (new, 3 cases):
  - Finds enabled webhooks subscribed to the event and
    enqueues one job per webhook.
  - Skips disabled webhooks.
  - Skips webhooks not subscribed to the event.
  - Queue / DB errors are swallowed.

- `src/jobs/workers/outboundWebhooks.test.ts`
  (new, 5 cases):
  - Successful POST: HMAC header is the SHA-256 of the
    body using the decrypted secret.
  - 200 response: increments lastFiredAt, leaves failCount
    at 0.
  - 500 response: throws (BullMQ retries).
  - 400 response: does NOT throw (returns), increments
    failCount.
  - failCount reaches 10: webhook auto-disabled
    (disabledAt populated).

- `src/services/bundles/index.test.ts`: existing tests
  unchanged — the dispatcher is best-effort and the
  service mock for it returns void.

---

## Acceptance criteria

- [x] Compiles, lints clean (no new violations), all
  vitest pass.
- [x] BundleService.publish + archive each fire the
  dispatcher.
- [x] Worker computes HMAC-SHA256 with the decrypted
  secret + POSTs to the URL.
- [x] 4xx responses don't trigger retries; 5xx do.
- [x] After 10 failures, the webhook auto-disables.

---

## Out of scope (deferred)

- **Custom event payloads** beyond the minimum (id +
  title + status). Merchants can ask for more.
- **Per-webhook retry policy** override.
- **Replay** (resend a recent failed delivery from the
  admin).
- **Inbound delivery receipts** / dashboard of recent
  attempts.
- **`bundle.low_stock` and `order.dispatched` emit
  sites** — separate tickets.
