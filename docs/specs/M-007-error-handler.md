# M-007 — Error Handler Middleware

## Goal

Replace the existing ad-hoc `src/middleware/errorHandler.ts` with a typed
error taxonomy + Express middleware that:

- Handles `AppError` and subclasses with their own `statusCode`.
- Maps `ZodError` to 400 with field-level detail.
- Falls back to 500 for unknown errors and logs with full stack.
- Attaches a `requestId` header (per-request UUID) for correlation.
- Provides a Sentry capture seam (no-op in M-007; M-015 wires real SDK).

## Why

Every API route ends in `next(err)`. A consistent error response shape is
the API contract. Per-request correlation is critical for triage when
support sees one bad order out of millions.

## Out of scope

- Sentry SDK install + DSN — M-015.
- AsyncLocalStorage request context propagation — start lightweight here
  (just attach to req object); deepen if many milestones need it.
- i18n of error messages — M-131.

## Design

### Error taxonomy

```ts
// src/middleware/errors.ts (new — extracted from errorHandler.ts)
export class AppError extends Error {
  statusCode: number;
  code: string;
  details?: unknown;
  isOperational: true;
  constructor(opts: { message: string; statusCode: number; code: string; details?: unknown });
}

export class NotFoundError extends AppError {}    // 404, code = "not_found"
export class ValidationError extends AppError {}  // 400, code = "validation_error"
export class UnauthorizedError extends AppError {}// 401, code = "unauthorized"
export class ForbiddenError extends AppError {}   // 403, code = "forbidden"
export class ConflictError extends AppError {}    // 409, code = "conflict"
export class RateLimitError extends AppError {}   // 429, code = "rate_limited"
```

### Middleware

```ts
// src/middleware/errorHandler.ts (rewritten)
export function requestId(req, _res, next): void { (req as any).id = randomUUID(); next(); }

export function captureError(err: unknown, req: Request): void { /* Sentry seam */ }

export function errorHandler(err, req, res, _next): void {
  // 1. AppError → use its statusCode/code/message/details
  // 2. ZodError → 400 + flattened issues
  // 3. else → 500 + log
  // Always attach req.id to res header X-Request-Id and to body.
  // Always call captureError for 5xx.
}
```

### Response shape

```json
{
  "error": {
    "code": "validation_error",
    "message": "title is required",
    "statusCode": 400,
    "requestId": "uuid",
    "details": { "fieldErrors": { "title": ["Required"] } }
  }
}
```

`details` is omitted for non-validation errors unless the AppError
subclass provides them.

## Acceptance criteria

- [ ] Typecheck + tests green.
- [ ] Tests:
  - [ ] AppError subclasses produce the correct statusCode + code.
  - [ ] ZodError is flattened into a 400 with `details.fieldErrors`.
  - [ ] Unknown thrown error becomes 500 with logged stack.
  - [ ] X-Request-Id header is set on every response (success + error).
  - [ ] Response body includes the same `requestId`.
  - [ ] captureError is called for 5xx, NOT for 4xx.
- [ ] Existing errorHandler imports continue to work (re-exports kept
      for compatibility with the bundle service stub).

## Files touched

- `src/middleware/errors.ts` (new)
- `src/middleware/errorHandler.ts` (rewritten; re-exports for back-compat)
- `src/middleware/errorHandler.test.ts` (new)
- `src/server/index.ts` (mount requestId middleware before routes)

## Open questions

- Whether to expose `details` only in dev or also in prod. Decision: keep
  the field, but never include raw stack traces in prod responses. Stack
  goes to logs via captureError.
