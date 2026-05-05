import { describe, it, expect, vi } from "vitest";

import { ordersCreateHandler } from "./ordersCreate";
import { BUNDLE_PROP } from "../../services/orders/extract";

describe("ordersCreateHandler", () => {
  it("does nothing when no bundle lines are present", async () => {
    const createBundleOrder = vi.fn();
    const handler = ordersCreateHandler({
      loadShop: async () => ({ id: "shop-uuid", settings: {} }),
      loadBundle: async () => null,
      createBundleOrder,
    });
    await handler({
      shopDomain: "demo.myshopify.com",
      webhookId: "wh-1",
      payload: { id: 1, line_items: [{ id: 1, title: "Plain" }] },
    });
    expect(createBundleOrder).not.toHaveBeenCalled();
  });

  it("creates a BundleOrder for each bundle-marked line", async () => {
    const createBundleOrder = vi.fn().mockResolvedValue({ id: "bo-1" });
    const adjust = vi.fn();
    const handler = ordersCreateHandler({
      loadShop: async () => ({ id: "shop-uuid", settings: { safetyLock: false } }),
      loadBundle: async (bundleId) => ({
        id: bundleId,
        items: [
          { shopifyProductGid: "gid://Product/1", quantity: 2, sku: "S1" },
        ],
        inventoryItemGid: null,
        locationGid: null,
      }),
      createBundleOrder,
      applyAdjust: adjust,
    });
    await handler({
      shopDomain: "demo.myshopify.com",
      webhookId: "wh-2",
      payload: {
        id: 100,
        admin_graphql_api_id: "gid://shopify/Order/100",
        name: "#1001",
        currency: "USD",
        line_items: [
          {
            id: 999,
            quantity: 3,
            price: "30.00",
            properties: [{ name: BUNDLE_PROP, value: "b-uuid" }],
          },
        ],
      },
    });
    expect(createBundleOrder).toHaveBeenCalledTimes(1);
    const args = createBundleOrder.mock.calls[0][0];
    expect(args.bundleId).toBe("b-uuid");
    expect(args.shopifyOrderNumber).toBe("#1001");
    expect((args.skuBreakdown as Array<{ quantity: number }>)[0].quantity).toBe(6);
    expect(adjust).not.toHaveBeenCalled(); // no inventoryItemGid wired
  });

  it("calls applyAdjust when bundle has inventoryItemGid + locationGid", async () => {
    const adjust = vi.fn().mockResolvedValue({ before: 10, after: 7, locked: false });
    const handler = ordersCreateHandler({
      loadShop: async () => ({ id: "shop-uuid", settings: {} }),
      loadBundle: async (bundleId) => ({
        id: bundleId,
        items: [{ shopifyProductGid: "gid://Product/1", quantity: 1 }],
        inventoryItemGid: "gid://Inv/1",
        locationGid: "gid://Loc/1",
      }),
      createBundleOrder: vi.fn().mockResolvedValue({ id: "bo" }),
      applyAdjust: adjust,
    });
    await handler({
      shopDomain: "demo.myshopify.com",
      webhookId: "wh-3",
      payload: {
        id: 100,
        line_items: [
          {
            quantity: 3,
            properties: [{ name: BUNDLE_PROP, value: "b-uuid" }],
          },
        ],
      },
    });
    expect(adjust).toHaveBeenCalledTimes(1);
    expect(adjust.mock.calls[0][0].delta).toBe(-3);
  });

  it("ignores order for unknown shop", async () => {
    const createBundleOrder = vi.fn();
    const handler = ordersCreateHandler({
      loadShop: async () => null,
      createBundleOrder,
    });
    await handler({
      shopDomain: "missing.myshopify.com",
      webhookId: "wh-4",
      payload: {
        line_items: [{ properties: [{ name: BUNDLE_PROP, value: "b" }] }],
      },
    });
    expect(createBundleOrder).not.toHaveBeenCalled();
  });
});
