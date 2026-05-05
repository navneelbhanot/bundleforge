/**
 * orders/updated handler (M-080).
 *
 * Reflects fulfillmentStatus changes onto BundleOrder rows. Full
 * cancellation is handled by orders/cancelled — orders/updated only
 * tracks partial fulfillment, refund-of-some-line-items, etc.
 */
import { prisma } from "../../config/database";
import { logger } from "../../config/logger";
import type { ShopifyOrderPayload } from "../../services/orders/extract";
import type { WebhookHandler } from "../handlers";

const handlerLogger = logger.child({ module: "wh:orders/updated" });

export interface FulfillmentUpdater {
  bundleOrder: {
    updateMany(args: {
      where: { shopId: string; shopifyOrderGid: string };
      data: { fulfillmentStatus?: string; status?: string };
    }): Promise<{ count: number }>;
  };
  shop: {
    findUnique(args: {
      where: { shopifyDomain: string };
      select: { id: true };
    }): Promise<{ id: string } | null>;
  };
}

interface PayloadWithFulfillment extends ShopifyOrderPayload {
  fulfillment_status?: string | null;
  cancelled_at?: string | null;
}

export interface OrdersUpdatedDeps {
  client?: FulfillmentUpdater;
}

export function ordersUpdatedHandler(
  deps: OrdersUpdatedDeps = {},
): WebhookHandler {
  const client =
    deps.client ?? (prisma as unknown as FulfillmentUpdater);

  return async ({ shopDomain, payload, webhookId }) => {
    const order = (payload ?? {}) as PayloadWithFulfillment;
    const gid = order.admin_graphql_api_id ?? "";
    if (!gid) {
      handlerLogger.warn({ shopDomain, webhookId }, "Order missing GID");
      return;
    }
    const shop = await client.shop.findUnique({
      where: { shopifyDomain: shopDomain },
      select: { id: true },
    });
    if (!shop) return;

    const data: { fulfillmentStatus?: string; status?: string } = {};
    if (order.fulfillment_status === "fulfilled") {
      data.fulfillmentStatus = "fulfilled";
      data.status = "fulfilled";
    } else if (order.fulfillment_status === "partial") {
      data.fulfillmentStatus = "partial";
    } else if (order.fulfillment_status === null || order.fulfillment_status === undefined) {
      data.fulfillmentStatus = "unfulfilled";
    }

    if (Object.keys(data).length === 0) return;

    const result = await client.bundleOrder.updateMany({
      where: { shopId: shop.id, shopifyOrderGid: gid },
      data,
    });
    handlerLogger.info(
      { shopDomain, gid, fulfillmentStatus: data.fulfillmentStatus, rowsUpdated: result.count },
      "BundleOrder fulfillmentStatus synced",
    );
  };
}
