/**
 * orders/cancelled handler (M-079).
 *
 * Reverses inventory for any BundleOrder rows associated with the
 * cancelled order, sets BundleOrder.status="cancelled".
 */
import { prisma } from "../../config/database";
import { logger } from "../../config/logger";
import { applyAdjustment } from "../../services/inventory";
import type { ShopifyOrderPayload } from "../../services/orders/extract";
import type { WebhookHandler } from "../handlers";

const handlerLogger = logger.child({ module: "wh:orders/cancelled" });

export interface OrdersCancelledDeps {
  loadShop?: (
    domain: string,
  ) => Promise<{ id: string } | null>;
  loadOrders?: (
    shopId: string,
    shopifyOrderGid: string,
  ) => Promise<
    Array<{
      id: string;
      bundleId: string;
      lineItems: unknown;
      shopifyOrderGid: string;
    }>
  >;
  loadBundle?: (
    bundleId: string,
    shopId: string,
  ) => Promise<{
    inventoryItemGid?: string | null;
    locationGid?: string | null;
  } | null>;
  cancelOrders?: (
    shopId: string,
    shopifyOrderGid: string,
  ) => Promise<{ count: number }>;
  applyAdjust?: typeof applyAdjustment;
}

interface ReversalLine {
  quantity?: number;
}

export function ordersCancelledHandler(
  deps: OrdersCancelledDeps = {},
): WebhookHandler {
  const loadShop =
    deps.loadShop ??
    (async (domain) =>
      prisma.shop.findUnique({
        where: { shopifyDomain: domain },
        select: { id: true },
      }));
  const loadOrders =
    deps.loadOrders ??
    (async (shopId, gid) =>
      prisma.bundleOrder.findMany({
        where: { shopId, shopifyOrderGid: gid },
        select: {
          id: true,
          bundleId: true,
          lineItems: true,
          shopifyOrderGid: true,
        },
      }));
  const loadBundle =
    deps.loadBundle ??
    (async () => ({ inventoryItemGid: null, locationGid: null }));
  const cancelOrders =
    deps.cancelOrders ??
    ((shopId, gid) =>
      prisma.bundleOrder.updateMany({
        where: { shopId, shopifyOrderGid: gid },
        data: { status: "cancelled" },
      }));
  const adjust = deps.applyAdjust ?? applyAdjustment;

  return async ({ shopDomain, payload, webhookId }) => {
    const order = (payload ?? {}) as ShopifyOrderPayload;
    const gid = order.admin_graphql_api_id ?? "";
    if (!gid) {
      handlerLogger.warn({ shopDomain, webhookId }, "Order missing GID");
      return;
    }
    const shop = await loadShop(shopDomain);
    if (!shop) return;

    const rows = await loadOrders(shop.id, gid);
    for (const row of rows) {
      try {
        const lines = (row.lineItems as ReversalLine[]) ?? [];
        const qty = Math.max(
          1,
          lines.reduce((sum, li) => sum + (li.quantity ?? 0), 0),
        );
        const bundle = await loadBundle(row.bundleId, shop.id);
        if (bundle?.inventoryItemGid && bundle.locationGid) {
          await adjust({
            shopId: shop.id,
            bundleId: row.bundleId,
            locationGid: bundle.locationGid,
            inventoryItemGid: bundle.inventoryItemGid,
            delta: qty, // restock
            reason: "order_cancelled",
            source: "webhook",
            referenceId: gid,
            metadata: { webhookId },
          });
        }
      } catch (err) {
        handlerLogger.error(
          { err, bundleOrderId: row.id, webhookId },
          "Failed to reverse inventory for cancelled order",
        );
      }
    }

    const result = await cancelOrders(shop.id, gid);
    handlerLogger.info(
      { shopDomain, gid, rowsCancelled: result.count },
      "BundleOrder rows marked cancelled",
    );
  };
}
