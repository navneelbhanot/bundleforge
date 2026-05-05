# M-015 — Sentry integration

## Goal

Wire `@sentry/node` behind a small in-house module so the M-007
`captureError` seam forwards to Sentry when a DSN is present. No-op
otherwise so dev/test stay quiet.

## Out of scope

- Tracing/profiling. tracesSampleRate is 0.1 in production, 0 elsewhere.
- Source maps upload. M-094 (after Vite build).
- User session replay.

## Acceptance criteria

- [ ] `src/config/sentry.ts` exports `initSentry()`, `captureException()`,
      `_resetSentryForTesting()`.
- [ ] `initSentry()` returns false (no-op) without DSN.
- [ ] `captureException` does not throw when SDK not initialized.
- [ ] M-007's `captureError` calls `captureException`.
- [ ] `startServer()` calls `initSentry()` before creating the app.
- [ ] Tests pass.

## Files touched

- `src/config/sentry.ts` (new)
- `src/config/sentry.test.ts` (new)
- `src/middleware/errorHandler.ts` (wire seam)
- `src/server/index.ts` (init at startServer)
