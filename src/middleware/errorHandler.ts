/**
 * Express error handler with typed taxonomy + request-id correlation.
 *
 * Public exports:
 *   requestId    — middleware that assigns req.id (UUID) and X-Request-Id header.
 *   captureError — Sentry capture seam (no-op until M-015).
 *   errorHandler — terminal Express error middleware.
 *
 * Re-exports the AppError taxonomy from ./errors so existing callers can
 * keep `import { ... } from "../middleware/errorHandler"`.
 *
 * See docs/specs/M-007-error-handler.md.
 */
import { randomUUID } from "node:crypto";

import { type Request, type Response, type NextFunction } from "express";
import { ZodError } from "zod";

import { logger } from "../config/logger";
import { captureException } from "../config/sentry";
import {
  AppError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
  RateLimitError,
  UnauthorizedError,
  ValidationError,
} from "./errors";

export {
  AppError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
  RateLimitError,
  UnauthorizedError,
  ValidationError,
};

const REQUEST_ID_HEADER = "X-Request-Id";

export function requestId(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const incoming = req.header(REQUEST_ID_HEADER);
  req.id = incoming && incoming.length > 0 ? incoming : randomUUID();
  res.setHeader(REQUEST_ID_HEADER, req.id);
  next();
}

/** Forwards 5xx and unknown errors to Sentry. No-op if Sentry not initialized. */
export function captureError(err: unknown, req: Request): void {
  captureException(err, { reqId: req.id, path: req.path, method: req.method });
}

interface ErrorBody {
  code: string;
  message: string;
  statusCode: number;
  requestId: string;
  details?: unknown;
}

function bodyFromAppError(err: AppError, requestId: string): ErrorBody {
  return {
    code: err.code,
    message: err.message,
    statusCode: err.statusCode,
    requestId,
    ...(err.details !== undefined ? { details: err.details } : {}),
  };
}

function bodyFromZodError(err: ZodError, requestId: string): ErrorBody {
  return {
    code: "validation_error",
    message: "Request validation failed",
    statusCode: 400,
    requestId,
    details: { fieldErrors: err.flatten().fieldErrors },
  };
}

export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction,
): void {
  const reqId = req.id || randomUUID();
  if (!res.getHeader(REQUEST_ID_HEADER)) {
    res.setHeader(REQUEST_ID_HEADER, reqId);
  }

  if (err instanceof AppError) {
    if (err.statusCode >= 500) {
      logger.error({ err, reqId }, "AppError 5xx");
      captureError(err, req);
    } else {
      logger.warn({ statusCode: err.statusCode, code: err.code, reqId }, err.message);
    }
    res.status(err.statusCode).json({ error: bodyFromAppError(err, reqId) });
    return;
  }

  if (err instanceof ZodError) {
    logger.warn({ reqId, issues: err.issues.length }, "Zod validation failed");
    res.status(400).json({ error: bodyFromZodError(err, reqId) });
    return;
  }

  // Unknown / unexpected.
  logger.error({ err, reqId }, "Unhandled error");
  captureError(err, req);
  res.status(500).json({
    error: {
      code: "internal_error",
      message: "Internal server error",
      statusCode: 500,
      requestId: reqId,
    },
  });
}
