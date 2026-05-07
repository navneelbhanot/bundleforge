/**
 * Resend SDK singleton (M-202).
 *
 * `getResend()` returns null when `RESEND_API_KEY` is unset — the
 * app runs fine without email (local dev, CI, the pre-Resend
 * production state). All call sites must handle the null case
 * (no-op + log) so a missing key never breaks a webhook.
 *
 * Mirrors the lazy pattern from `src/shopify/index.ts`: don't
 * instantiate at module load, instantiate on first access. Lets
 * the env-validation step run first.
 */
import { Resend } from "resend";

import { env } from "../../config/env";

let _client: Resend | null = null;

export function getResend(): Resend | null {
  if (!env.RESEND_API_KEY) return null;
  if (!_client) _client = new Resend(env.RESEND_API_KEY);
  return _client;
}

/**
 * Reset the client. Test-only — production callers never need this.
 */
export function resetResendClientForTesting(): void {
  _client = null;
}

/**
 * Default From header. Subdomain isolates transactional sender
 * reputation from the human Workspace inbox at
 * support@mintbundle.app. Override via `EMAIL_FROM` env.
 */
export const DEFAULT_FROM =
  "MintBundle <notifications@mail.mintbundle.app>";

export function fromAddress(): string {
  return env.EMAIL_FROM ?? DEFAULT_FROM;
}
