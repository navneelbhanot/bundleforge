/**
 * Public email send API (M-202).
 *
 * `sendEmail` is the only function any feature should call. It
 * dispatches to Resend if configured, no-ops otherwise, and
 * NEVER throws — a failed send must never fail the surrounding
 * transaction (webhook, queue job, request handler).
 *
 * The caller decides retry policy. For cap notifications we
 * deliberately do NOT retry — a duplicate send is a worse merchant
 * experience than a missed one we can re-derive next month.
 */
import { logger } from "../../config/logger";

import { fromAddress, getResend } from "./client";

const log = logger.child({ module: "email" });

export interface SendEmailArgs {
  to: string;
  subject: string;
  html: string;
  text: string;
  /** Optional per-call From override. Defaults to `fromAddress()`. */
  from?: string;
}

export interface SendEmailResult {
  ok: boolean;
  /** Resend's message id when the send actually went out. */
  id?: string;
  /** Resend or transport error message when ok=false. */
  error?: string;
  /**
   * True when the call no-op'd because `RESEND_API_KEY` is unset
   * (local dev, CI, pre-Resend production). Treated as success.
   */
  skipped?: boolean;
}

export async function sendEmail(args: SendEmailArgs): Promise<SendEmailResult> {
  const resend = getResend();
  if (!resend) {
    log.warn(
      { to: args.to, subject: args.subject },
      "RESEND_API_KEY unset — email skipped",
    );
    return { ok: true, skipped: true };
  }
  try {
    const result = await resend.emails.send({
      from: args.from ?? fromAddress(),
      to: args.to,
      subject: args.subject,
      html: args.html,
      text: args.text,
    });
    if (result.error) {
      log.error(
        { err: result.error, to: args.to, subject: args.subject },
        "Resend rejected email",
      );
      return { ok: false, error: result.error.message };
    }
    log.info(
      { id: result.data?.id, to: args.to, subject: args.subject },
      "Email sent",
    );
    return { ok: true, id: result.data?.id };
  } catch (err) {
    log.error(
      { err, to: args.to, subject: args.subject },
      "Email send threw",
    );
    return { ok: false, error: (err as Error).message };
  }
}

export type EmailTemplate = {
  subject: string;
  html: string;
  text: string;
};
