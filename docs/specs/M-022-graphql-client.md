# M-022 — GraphQL Admin API client wrapper

## Goal

Thin wrapper at `src/shopify/graphql.ts` so domain services don't import
the Shopify SDK directly. Adds throttle-aware retry and Pino logging.

## Out of scope

- GraphQL codegen — when types matter, the caller passes them.
- Cost-aware adaptive throttling — basic 1-retry behavior is enough for now.

## Design

```ts
export async function shopifyGraphql<T>(
  session: Session,
  query: string,
  variables?: Record<string, unknown>,
): Promise<T>;
```

Uses `shopify.api.clients.Graphql({session})`, calls `.request()`, on
`THROTTLED` waits 1s and retries once. Logs throttle events to Pino.

Tests inject a fake `request` function via DI to exercise paths.

## Acceptance criteria

- [ ] Happy path returns parsed body.
- [ ] THROTTLED triggers one retry; second success returns body.
- [ ] Two consecutive THROTTLED throws.
- [ ] Other errors throw immediately (no retry).

## Files touched

- `src/shopify/graphql.ts`
- `src/shopify/graphql.test.ts`
