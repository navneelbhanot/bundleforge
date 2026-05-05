/**
 * Typed error taxonomy used across the API.
 *
 * Every operational failure should throw an AppError subclass so the
 * error handler can map it to a consistent response.
 *
 * See docs/specs/M-007-error-handler.md.
 */
export interface AppErrorOptions {
  message: string;
  statusCode: number;
  code: string;
  details?: unknown;
}

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly details: unknown;
  public readonly isOperational = true as const;

  constructor(opts: AppErrorOptions) {
    super(opts.message);
    this.name = "AppError";
    this.statusCode = opts.statusCode;
    this.code = opts.code;
    this.details = opts.details;
    if (typeof Error.captureStackTrace === "function") {
      Error.captureStackTrace(this, new.target);
    }
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string, details?: unknown) {
    super({
      message: `${resource} not found`,
      statusCode: 404,
      code: "not_found",
      details,
    });
    this.name = "NotFoundError";
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: unknown) {
    super({ message, statusCode: 400, code: "validation_error", details });
    this.name = "ValidationError";
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "Unauthorized", details?: unknown) {
    super({ message, statusCode: 401, code: "unauthorized", details });
    this.name = "UnauthorizedError";
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "Forbidden", details?: unknown) {
    super({ message, statusCode: 403, code: "forbidden", details });
    this.name = "ForbiddenError";
  }
}

export class ConflictError extends AppError {
  constructor(message: string, details?: unknown) {
    super({ message, statusCode: 409, code: "conflict", details });
    this.name = "ConflictError";
  }
}

export class RateLimitError extends AppError {
  constructor(retryAfterSeconds?: number) {
    super({
      message: "Too many requests",
      statusCode: 429,
      code: "rate_limited",
      details: retryAfterSeconds ? { retryAfterSeconds } : undefined,
    });
    this.name = "RateLimitError";
  }
}
