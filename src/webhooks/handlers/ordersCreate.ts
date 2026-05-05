/**
 * orders/create handler (M-078).
 *
 * For each bundle-marked line item:
 *  - Persist a BundleOrder row.
 *  - Decrement inventory via applyAdjustment(delta=-qty).
 *  - Compute SKU breakdown for fulfillment.
 *
 * Hostile branches (no shop, unknown bundle, missing items) are logged
 * and skipped — never throw past the registry, so a single bad order
 * doesn't poison the queue.
 */
import { prisma } from "../../config/database";
import { logger } from "../../config/logger";
import {
  applyAdjustment,
  type ApplyAdjustmentResult,
} from "../../services/inventory";
import {
  extractBundleLineItems,
  type ShopifyOrderPayload,
} from "../../services/orders/extract";
import {
  breakdownBundleSkus,
  type BundleItemSnapshot,
} from "../../services/orders/skuBreakdown";
import type { WebhookHandler } from "../handlers";

const handlerLogger = logger.child({ module: "wh:orders/create" });

export interface OrdersCreateDeps {
  loadShop?: (
    domain: string,
  ) => Promise<{ id: string; settings: { safetyLock?: boolean } } | null>;
  loadBundle?: (
    bundleId: string,
    shopId: string,
  ) => Promise<{
    id: string;
    items: BundleItemSnapshot[];
    inventoryItemGid?: string | null;
    locationGid?: string | null;
  } | null>;
  createBundleOrder?: (data: {
    shopId: string;
    bundleId: string;
    shopifyOrderGid: string;
    shopifyOrderId: bigint;
    shopifyOrderNumber: string;
    customerId?: string | null;
    bundlePrice: string;
    originalPrice: string;
    discountAmount: string;
    currency: string;
    lineItems: unknown;
    skuBreakdown: unknown;
  }) => Promise<{ id: string }>;
  applyAdjust?: typeof applyAdjustment;
}

export function ordersCreateHandler(
  deps: OrdersCreateDeps = {},
): WebhookHandler {
  const loadShop =
    deps.loadShop ??
    (async (domain: string) => {
      const shop = await prisma.shop.findUnique({
        where: { shopifyDomain: domain },
        select: { id: true, settings: true },
      });
      if (!shop) return null;
      const settings = (shop.settings ?? {}) as { safetyLock?: boolean };
      return { id: shop.id, settings };
    });
  const loadBundle =
    deps.loadBundle ??
    (async (bundleId, shopId) => {
      const b = await prisma.bundle.findFirst({
        where: { id: bundleId, shopId, deletedAt: null },
        include: { items: true },
      });
      if (!b) return null;
      return {
        id: b.id,
        items: b.items.map((it) => ({
          sku: it.sku ?? null,
          shopifyProductGid: it.shopifyProductGid,
          shopifyVariantGid: it.shopifyVariantGid ?? null,
          title: it.title,
          quantity: it.quantity,
        })),
        inventoryItemGid: null,
        locationGid: null,
      };
    });
  const createBundleOrder =
    deps.createBundleOrder ??
    ((data) =>
      prisma.bundleOrder.create({
        data: {
          shopId: data.shopId,
          bundleId: data.bundleId,
          shopifyOrderGid: data.shopifyOrderGid,
          shopifyOrderId: data.shopifyOrderId,
          shopifyOrderNumber: data.shopifyOrderNumber,
          customerId: data.customerId ?? undefined,
          status: "processed",
          bundlePrice: data.bundlePrice,
          originalPrice: data.originalPrice,
          discountAmount: data.discountAmount,
          currency: data.currency,
          lineItems: data.lineItems as object,
          skuBreakdown: data.skuBreakdown as object,
        },
        select: { id: true },
      }));
  const adjust = deps.applyAdjust ?? applyAdjustment;

  return async ({ shopDomain, payload, webhookId }) => {
    const order = (payload ?? {}) as ShopifyOrderPayload;
    const bundleLines = extractBundleLineItems(order);
    if (bundleLines.length === 0) {
      handlerLogger.debug({ shopDomain, webhookId }, "No bundle lines in order");
      return;
    }
    const shop = await loadShop(shopDomain);
    if (!shop) {
      handlerLogger.warn({ shopDomain, webhookId }, "Unknown shop for order");
      return;
    }

    for (const { bundleId, lineItem } of bundleLines) {
      try {
        const bundle = await loadBundle(bundleId, shop.id);
        if (!bundle) {
          handlerLogger.warn(
            { shopDomain, bundleId, webhookId },
            "Bundle not found for order",
          );
          continue;
        }
        const qty = Math.max(1, lineItem.quantity ?? 1);
        const skuBreakdown = breakdownBundleSkus(bundle.items, qty);
        const orderGid = order.admin_graphql_api_id ?? "";
        const orderId = BigInt(order.id ?? 0);
        const orderNumber = order.name ?? String(order.number ?? "");
        const currency = order.currency ?? "USD";

        await createBundleOrder({
          shopId: shop.id,
          bundleId,
          shopifyOrderGid: orderGid,
          shopifyOrderId: orderId,
          shopifyOrderNumber: orderNumber,
          customerId: order.customer?.admin_graphql_api_id ?? null,
          bundlePrice: lineItem.price ?? "0",
          originalPrice: lineItem.price ?? "0",
          discountAmount: "0",
          currency,
          lineItems: [lineItem],
          skuBreakdown,
        });

        // Inventory: only attempt if the bundle has inventoryItemGid +
        // location. Otherwise we have nothing to decrement (data not yet
        // wired). Real wiring in M-080+ when Shopify sync lands.
        if (bundle.inventoryItemGid && bundle.locationGid) {
          const result: ApplyAdjustmentResult = await adjust({
            shopId: shop.id,
            bundleId,
            locationGid: bundle.locationGid,
            inventoryItemGid: bundle.inventoryItemGid,
            delta: -qty,
            reason: "order_placed",
            source: "webhook",
            referenceId: orderGid,
            shopSafetyLockOn: shop.settings.safetyLock,
            metadata: { webhookId },
          });
          handlerLogger.info(
            { bundleId, qty, before: result.before, after: result.after, locked: result.locked },
            "Inventory adjusted for bundle order",
          );
        }
      } catch (err) {
        handlerLogger.error(
          { err, bundleId, webhookId },
          "Failed to process bundle line item",
        );
      }
    }
  };
}
