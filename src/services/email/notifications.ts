/**
 * Cap-status notification orchestration (M-202).
 *
 * `maybeNotifyCapStatus` is called from `ordersCreate` after every
 * BundleOrder write. It checks whether the shop just crossed an
 * email-worthy threshold (80% warning, 100% reached) and, if so,
 * sends one email of that type per shop per calendar month.
 *
 * Idempotency is per-month: the sent state is stored in
 * `Shop.settings.capNotifications.{warningSentMonth,
 * reachedSentMonth}` as YYYY-MM strings. A small race window
 * exists where two simultaneous orders could both decide to
 * send — accepted for first ship; volume is too low for it to
 * matter and a duplicate notification is a smaller harm than a
 * missed one.
 *
 * Always non-throwing: an email failure NEVER fails the webhook
 * that called this function.
 */
import type { Prisma } from "../../generated/prisma";

import { logger } from "../../config/logger";
import { env } from "../../config/env";
import {
  isOverOrderCap,
  type OrderCapPrisma,
} from "../billing/orderCap";
import { sendEmail } from ".";
import { capWarningTemplate } from "./templates/capWarning";
import { capReachedTemplate } from "./templates/capReached";

const log = logger.child({ module: "email-notifications" });

const APPROACHING_THRESHOLD = 0.8;

export interface NotifyCapShop {
  id: string;
  name: string;
  email: string;
  planName: string;
  settings: Prisma.JsonValue;
}

export interface NotifyCapPrisma extends OrderCapPrisma {
  shop: {
    update(args: {
      where: { id: string };
      data: { settings: Prisma.InputJsonValue };
    }): Promise<{ id: string }>;
  };
}

/**
 * Format a UTC Date as `YYYY-MM`. Stable across timezones (we
 * deliberately ignore Shop.timezone — see M-200 spec for the
 * rationale).
 */
export function monthKey(now: Date): string {
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

interface CapNotificationsState {
  warningSentMonth?: string;
  reachedSentMonth?: string;
}

function readNotificationState(settings: Prisma.JsonValue): CapNotificationsState {
  if (!settings || typeof settings !== "object" || Array.isArray(settings)) {
    return {};
  }
  const cap = (settings as Record<string, unknown>).capNotifications;
  if (!cap || typeof cap !== "object" || Array.isArray(cap)) {
    return {};
  }
  const c = cap as Record<string, unknown>;
  return {
    warningSentMonth:
      typeof c.warningSentMonth === "string" ? c.warningSentMonth : undefined,
    reachedSentMonth:
      typeof c.reachedSentMonth === "string" ? c.reachedSentMonth : undefined,
  };
}

function mergeNotificationState(
  settings: Prisma.JsonValue,
  patch: CapNotificationsState,
): Prisma.InputJsonValue {
  const base =
    settings && typeof settings === "object" && !Array.isArray(settings)
      ? (settings as Record<string, unknown>)
      : {};
  const existing = readNotificationState(settings);
  return {
    ...base,
    capNotifications: {
      ...existing,
      ...patch,
    },
  } as Prisma.InputJsonValue;
}

/**
 * Resolve the URL the email's "Upgrade to Growth" button should
 * deep-link to. Goes to Settings → Billing on the embedded admin.
 *
 * NOTE: this URL won't carry a Shopify session cookie when the
 * merchant clicks from desktop email — it'll bounce through
 * OAuth. Acceptable for first ship.
 */
function upgradeUrlFor(): string {
  return `${env.SHOPIFY_APP_URL.replace(/\/$/, "")}/settings#billing`;
}

export interface NotifyCapDeps {
  /** Inject a different mailer (tests). */
  send?: typeof sendEmail;
  /** Inject "now" (tests). */
  now?: () => Date;
}

export type NotifyCapOutcome =
  | { kind: "noop"; reason: string }
  | { kind: "warning_sent"; messageId?: string }
  | { kind: "reached_sent"; messageId?: string }
  | { kind: "send_failed"; level: "warning" | "reached"; error: string };

/**
 * Inspect `shop`'s current cap usage and send a cap-warning or
 * cap-reached email if appropriate. Returns the outcome so the
 * caller can log it.
 */
export async function maybeNotifyCapStatus(
  prisma: NotifyCapPrisma,
  shop: NotifyCapShop,
  deps: NotifyCapDeps = {},
): Promise<NotifyCapOutcome> {
  const send = deps.send ?? sendEmail;
  const now = deps.now ? deps.now() : new Date();

  const cap = await isOverOrderCap(
    prisma,
    { id: shop.id, planName: shop.planName },
    now,
  );
  if (cap.cap === null) {
    return { kind: "noop", reason: "paid_plan" };
  }

  const state = readNotificationState(shop.settings);
  const month = monthKey(now);

  if (cap.over) {
    if (state.reachedSentMonth === month) {
      return { kind: "noop", reason: "reached_already_sent_this_month" };
    }
    const tmpl = capReachedTemplate({
      shopName: shop.name,
      cap: cap.cap,
      upgradeUrl: upgradeUrlFor(),
    });
    const result = await send({
      to: shop.email,
      subject: tmpl.subject,
      html: tmpl.html,
      text: tmpl.text,
    });
    if (!result.ok) {
      log.error(
        { shopId: shop.id, level: "reached", err: result.error },
        "cap-reached email send failed",
      );
      return {
        kind: "send_failed",
        level: "reached",
        error: result.error ?? "unknown",
      };
    }
    await prisma.shop.update({
      where: { id: shop.id },
      data: {
        settings: mergeNotificationState(shop.settings, {
          reachedSentMonth: month,
        }),
      },
    });
    return { kind: "reached_sent", messageId: result.id };
  }

  // Approaching: count/cap >= 0.8 but not yet over.
  const ratio = cap.count / cap.cap;
  if (ratio >= APPROACHING_THRESHOLD) {
    if (state.warningSentMonth === month) {
      return { kind: "noop", reason: "warning_already_sent_this_month" };
    }
    const tmpl = capWarningTemplate({
      shopName: shop.name,
      count: cap.count,
      cap: cap.cap,
      upgradeUrl: upgradeUrlFor(),
    });
    const result = await send({
      to: shop.email,
      subject: tmpl.subject,
      html: tmpl.html,
      text: tmpl.text,
    });
    if (!result.ok) {
      log.error(
        { shopId: shop.id, level: "warning", err: result.error },
        "cap-warning email send failed",
      );
      return {
        kind: "send_failed",
        level: "warning",
        error: result.error ?? "unknown",
      };
    }
    await prisma.shop.update({
      where: { id: shop.id },
      data: {
        settings: mergeNotificationState(shop.settings, {
          warningSentMonth: month,
        }),
      },
    });
    return { kind: "warning_sent", messageId: result.id };
  }

  return { kind: "noop", reason: "below_threshold" };
}
