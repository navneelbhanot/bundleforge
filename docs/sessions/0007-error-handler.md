# Session 0007 — Error Handler Middleware

- **Date:** 2026-05-04
- **Milestone(s):** M-007

## What was done

- Wrote `docs/specs/M-007-error-handler.md`.
- New `src/middleware/errors.ts`: `AppError` base + `NotFoundError`,
  `ValidationError`, `UnauthorizedError`, `ForbiddenError`,
  `ConflictError`, `RateLimitError`. Each carries `statusCode`, `code`,
  optional `details`, `isOperational`.
- Rewrote `src/middleware/errorHandler.ts`:
  - `requestId` middleware: assigns `req.id` (UUID, or honors incoming
    `X-Request-Id`), echoes the header on the response.
  - `captureError` Sentry seam (no-op until M-015).
  - `errorHandler`: dispatches on `AppError` / `ZodError` / unknown,
    consistent `{ error: { code, message, statusCode, requestId, details? } }`
    response shape, captures 5xx through the Sentry seam.
  - Re-exports the AppError taxonomy so existing imports from
    `../middleware/errorHandler` keep working.
- New `src/types/express.d.ts`: module-augments Express's Request to
  declare `id: string` so middleware/routes can use `req.id` without
  casts.
- Wired `requestId` into `src/server/index.ts` ahead of `pino-http` so
  request logs share the same id.
- Added `src/middleware/errorHandler.test.ts` — 13 cases.

## Acceptance criteria

- [x] All criteria from the spec pass; 71 tests total.

## Surprises and learnings

- pino-http already augments Express `Request` with `id: ReqId`. Our
  augmentation must be type-compatible (string ⊆ ReqId). Settled by
  declaring `id: string` in our augmentation; the contract is that we
  always assign a string.
- ZodError's `.flatten().fieldErrors` is the right shape for client
  forms. Avoids the verbose `format()` output.

## Deferred

- Sentry SDK install + DSN wiring → M-015 fills `captureError`.
- Per-request asyncLocalStorage context → only when a future milestone
  needs it cross-cuttingly.

## Handoff

Next: **M-008 — Rate limiter middleware + tests**. The current
implementation works but has hardcoded points/duration and is not
plan-aware. M-008: per-shop key derivation, plan-aware caps (read from
M-031 plan registry — reserve a stub if not yet done), proper tests
against an in-memory limiter to avoid Redis dependency in unit tests.
