# M-023 — REST Admin API client wrapper

## Goal

Mirror M-022 for the SDK's REST client at `src/shopify/rest.ts`.
Session-scoped, retry on 429 once, Pino logging, DI-friendly.

## Why

GraphQL is the primary path. REST is only a fallback for endpoints
without GraphQL parity (rare, but real). Wrapping it now keeps domain
services decoupled from the SDK.

## Design

```ts
export async function shopifyRest<T>(
  session: Session,
  args: { method: "GET" | "POST" | "PUT" | "DELETE"; path: string; query?: Record<string, string|number>; body?: unknown },
  opts?: { clientFactory?: ...; sleepMs?: number },
): Promise<T>;
```

429 → wait 1s → retry once. On non-2xx with non-429, throw.

## Acceptance criteria

- [ ] Happy path returns body.
- [ ] 429 retried once, second 200 returns body.
- [ ] Two consecutive 429 throws.
- [ ] Non-429 error throws immediately.
- [ ] Boot phase green.

## Files touched

- `src/shopify/rest.ts`
- `src/shopify/rest.test.ts`
