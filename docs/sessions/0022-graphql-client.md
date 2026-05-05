# Session 0022 — GraphQL Admin API client wrapper

- **Date:** 2026-05-04
- **Milestone(s):** M-022

## What was done

- New `src/shopify/graphql.ts`: `shopifyGraphql<T>(session, query, vars?,
  opts?)`. Wraps the SDK's GraphQL client, retries once on THROTTLED,
  logs throttle and error events to Pino, throws on non-throttle errors
  immediately. Test-friendly via DI of clientFactory + sleepMs.
- 5 unit tests cover happy path, single retry, double-throttle failure,
  non-throttle error (no retry), and missing-data response.

## Acceptance

- [x] All spec items pass. 103 tests.

## Handoff

Next: **M-023 — REST Admin API client wrapper**. Same shape as M-022
but for the SDK's REST client. The REST API is the fallback for
endpoints that don't yet have GraphQL equivalents (e.g., legacy
Webhooks API). One file + a couple of tests.
