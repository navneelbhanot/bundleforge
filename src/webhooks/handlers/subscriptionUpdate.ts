/**
 * app_subscriptions/update handler. Reflects the Shopify subscription
 * lifecycle into BillingSubscription.
 *
 * See docs/specs/M-033-subscription-sync.md.
 */
import { prisma } from "../../config/database";
import { logger } from "../../config/logger";
import type { WebhookHandler } from "../handlers";

const handlerLogger = logger.child({ module: "wh:app_subscriptions/update" });

interface SubscriptionPayload {
  app_subscription?: {
    admin_graphql_api_id?: string;
    id?: number;
    status?: string;
  };
}

const STATUS_MAP: Record<string, string> = {
  active: "active",
  declined: "cancelled",
  cancelled: "cancelled",
  canceled: "cancelled",
  expired: "expired",
  frozen: "frozen",
  pending: "pending",
};

export interface BillingUpdateClient {
  updateMany(args: {
    where: { shopifyChargeId: string };
    data: Record<string, unknown>;
  }): Promise<{ count: number }>;
}

export function subscriptionUpdateHandler(
  client: BillingUpdateClient = prisma.billingSubscription as unknown as BillingUpdateClient,
): WebhookHandler {
  return async ({ shopDomain, payload }) => {
    const sub = (payload as SubscriptionPayload)?.app_subscription;
    const gid = sub?.admin_graphql_api_id ?? "";
    const rawStatus = (sub?.status ?? "").toLowerCase();
    if (!gid || !rawStatus) {
      handlerLogger.warn({ shopDomain }, "Payload missing app_subscription gid or status");
      return;
    }
    const status = STATUS_MAP[rawStatus] ?? rawStatus;

    const data: Record<string, unknown> = { status };
    if (status === "active") data.activatedAt = new Date();
    if (status === "cancelled") data.cancelledAt = new Date();

    const result = await client.updateMany({
      where: { shopifyChargeId: gid },
      data,
    });
    handlerLogger.info(
      { shopDomain, gid, status, rowsUpdated: result.count },
      "BillingSubscription synced from webhook",
    );
  };
}
