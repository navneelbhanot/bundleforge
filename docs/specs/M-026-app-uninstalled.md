# M-026 — Webhook handler: app/uninstalled + handler registry

## Goal

Build a small handler-registry pattern in `src/webhooks/handlers.ts` so
M-027–M-030 can plug in uniformly. Implement the first handler:
`app/uninstalled` sets `Shop.uninstalledAt = now()`. Wire a worker that
consumes the webhooks queue and dispatches by topic.

## Why

Centralized routing eliminates a long chain of if/else in the worker
and makes new handlers trivial to add.

## Design

```ts
// src/webhooks/handlers.ts
export type WebhookHandler = (input: { shopDomain: string; payload: unknown; webhookId: string }) => Promise<void>;
export const handlers: Map<string, WebhookHandler>;
export function registerHandler(topic: string, handler: WebhookHandler): void;
export async function dispatch(topic: string, input: ...): Promise<void>;
```

```ts
// src/webhooks/handlers/appUninstalled.ts
export const appUninstalled: WebhookHandler;
```

Worker is in `src/jobs/webhooksWorker.ts` — separate from `worker.ts`
which already runs order/inventory queues.

## Acceptance criteria

- [ ] handlers.ts exposes registry + dispatch + register.
- [ ] app/uninstalled handler sets uninstalledAt via injected client.
- [ ] Tests: handler updates correct shop; dispatch unknown topic logs but does not throw.

## Files touched

- `src/webhooks/handlers.ts`
- `src/webhooks/handlers/appUninstalled.ts`
- `src/webhooks/handlers/appUninstalled.test.ts`
- `src/jobs/webhooksWorker.ts`
