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
import { maybeNotifyCapStatus } from "../../services/email/notifications";
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
import { shopify } from "../../shopify";
import { shopifyGraphql } from "../../shopify/graphql";
import type { WebhookHandler } from "../handlers";

/**
 * Tags this milestone applies to a Shopify order so merchants can
 * spot bundle orders at a glance. We use `tagsAdd` (additive) not
 * `orderUpdate` (which replaces tags wholesale), so we never
 * clobber tags the merchant or other apps set.
 */
const TAGS_ADD_MUTATION = `#graphql
  mutation BundleforgeTagsAdd($id: ID!, $tags: [String!]!) {
    tagsAdd(id: $id, tags: $tags) {
      node { id }
      userErrors { field message }
    }
  }
`;

interface TagsAddResponse {
  tagsAdd?: {
    node?: { id?: string };
    userErrors?: Array<{ field?: string[]; message: string }>;
  };
}

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
    title: string;
    items: BundleItemSnapshot[];
    inventoryItemGid?: string | null;
    locationGid?: string | null;
  } | null>;
  markOrderInShopify?: (args: {
    shopDomain: string;
    orderGid: string;
    bundleTitle: string;
  }) => Promise<void>;
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
  /**
   * M-202: cap-notification hook. Called once per order after all
   * BundleOrder rows are written. Default implementation fetches
   * the shop record and delegates to
   * `services/email/notifications.maybeNotifyCapStatus`. Tests
   * stub this to avoid touching Prisma + Resend.
   *
   * Failure is logged and swallowed — email problems must NEVER
   * fail an order webhook.
   */
  notifyCapStatus?: (shopId: string) => Promise<void>;
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
        title: b.title,
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
  const markOrderInShopify =
    deps.markOrderInShopify ??
    (async ({ shopDomain, orderGid, bundleTitle }) => {
      // Load the offline session for this shop. This is the same
      // session the SDK persists at OAuth install time. If it's
      // missing (uninstalled mid-flight, never installed) we just
      // log and skip — the BundleOrder row is already persisted.
      const storage = shopify.config.sessionStorage;
      if (!storage) {
        handlerLogger.warn(
          { shopDomain },
          "No session storage configured — can't tag order",
        );
        return;
      }
      const sessions = await storage.findSessionsByShop(shopDomain);
      const offline = sessions.find((s) => s.isOnline === false);
      if (!offline) {
        handlerLogger.warn(
          { shopDomain },
          "No offline session for shop — can't tag order",
        );
        return;
      }
      // Tag list:
      //  - "bundleforge"      → app-wide filter
      //  - "bundle"           → simpler filter for ops
      //  - "bundle: <title>"  → human-readable per-bundle marker
      // Shopify tags are case-insensitive and trimmed; we cap the
      // title slice at 100 chars to stay under their per-tag limit.
      const titleTag = `bundle: ${bundleTitle.slice(0, 100)}`;
      const data = await shopifyGraphql<TagsAddResponse>(
        offline,
        TAGS_ADD_MUTATION,
        {
          id: orderGid,
          tags: ["bundleforge", "bundle", titleTag],
        },
      );
      const userErrors = data.tagsAdd?.userErrors ?? [];
      if (userErrors.length > 0) {
        handlerLogger.warn(
          { orderGid, userErrors },
          "tagsAdd userErrors",
        );
      }
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
  const notifyCapStatus =
    deps.notifyCapStatus ??
    (async (shopId: string) => {
      // Reload the shop with the fields the cap-notification email
      // needs (name, email, planName, settings). Cheap point-read
      // on the primary key — fine to run after every order.
      const full = await prisma.shop.findUnique({
        where: { id: shopId },
        select: {
          id: true,
          name: true,
          email: true,
          planName: true,
          settings: true,
        },
      });
      if (!full) return;
      await maybeNotifyCapStatus(prisma, full);
    });

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

        // Tag the Shopify order so it's identifiable in the merchant's
        // native Orders list. Failure here MUST NOT fail the webhook —
        // the BundleOrder row is already persisted, and a missing
        // tag is a UI nuisance, not a data integrity problem.
        if (orderGid) {
          try {
            await markOrderInShopify({
              shopDomain,
              orderGid,
              bundleTitle: bundle.title,
            });
          } catch (tagErr) {
            handlerLogger.warn(
              { err: tagErr, orderGid, bundleId, webhookId },
              "Failed to tag Shopify order — BundleOrder row persisted regardless",
            );
          }
        }

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

    // M-202: cap-status email notifications. Runs once per webhook
    // (not per bundle line) since notifications are per-shop. A
    // failure here MUST NEVER fail the webhook — the BundleOrder
    // rows are already persisted; a missed email is recoverable
    // (we'll either notify on the next order, or at the next
    // monthly boundary the state resets).
    try {
      await notifyCapStatus(shop.id);
    } catch (err) {
      handlerLogger.warn(
        { err, shopId: shop.id, webhookId },
        "cap-status notification failed — order persisted regardless",
      );
    }
  };
}
