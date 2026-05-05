/**
 * Sentry initialization. No-op when env.SENTRY_DSN is unset, so dev and
 * tests stay quiet.
 *
 * The error handler (M-007) calls captureException(); this module is the
 * single point that decides whether to forward to the real SDK.
 *
 * See docs/specs/M-015-sentry.md.
 */
import * as Sentry from "@sentry/node";

import { env } from "./env";
import { logger } from "./logger";

let initialized = false;

export function initSentry(): boolean {
  if (initialized) return true;
  if (!env.SENTRY_DSN) {
    return false;
  }
  Sentry.init({
    dsn: env.SENTRY_DSN,
    environment: env.NODE_ENV,
    release: env.APP_VERSION,
    tracesSampleRate: env.NODE_ENV === "production" ? 0.1 : 0,
  });
  initialized = true;
  logger.info({ environment: env.NODE_ENV }, "Sentry initialized");
  return true;
}

export function captureException(err: unknown, context?: Record<string, unknown>): void {
  if (!initialized) return;
  Sentry.captureException(err, context ? { extra: context } : undefined);
}

/** Test-only: reset cached init state. */
export function _resetSentryForTesting(): void {
  initialized = false;
}
