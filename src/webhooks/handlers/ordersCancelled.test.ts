import { describe, it, expect, vi } from "vitest";

import { ordersCancelledHandler } from "./ordersCancelled";

describe("ordersCancelledHandler", () => {
  it("reverses inventory for each BundleOrder and marks status=cancelled", async () => {
    const adjust = vi.fn().mockResolvedValue({ before: 7, after: 10, locked: false });
    const cancelOrders = vi.fn().mockResolvedValue({ count: 2 });
    const handler = ordersCancelledHandler({
      loadShop: async () => ({ id: "shop-uuid" }),
      loadOrders: async () => [
        {
          id: "bo-1",
          bundleId: "b-1",
          lineItems: [{ quantity: 3 }],
          shopifyOrderGid: "gid://Order/1",
        },
        {
          id: "bo-2",
          bundleId: "b-2",
          lineItems: [{ quantity: 1 }],
          shopifyOrderGid: "gid://Order/1",
        },
      ],
      loadBundle: async () => ({
        inventoryItemGid: "gid://Inv/1",
        locationGid: "gid://Loc/1",
      }),
      cancelOrders,
      applyAdjust: adjust,
    });
    await handler({
      shopDomain: "demo.myshopify.com",
      webhookId: "wh-c",
      payload: { admin_graphql_api_id: "gid://Order/1" },
    });
    expect(adjust).toHaveBeenCalledTimes(2);
    expect(adjust.mock.calls[0][0].delta).toBe(3);
    expect(adjust.mock.calls[1][0].delta).toBe(1);
    expect(cancelOrders).toHaveBeenCalledWith("shop-uuid", "gid://Order/1");
  });

  it("noops on missing GID or unknown shop", async () => {
    const adjust = vi.fn();
    const cancelOrders = vi.fn();
    const handler = ordersCancelledHandler({
      loadShop: async () => null,
      cancelOrders,
      applyAdjust: adjust,
    });
    await handler({
      shopDomain: "x",
      webhookId: "wh",
      payload: {},
    });
    expect(adjust).not.toHaveBeenCalled();
    expect(cancelOrders).not.toHaveBeenCalled();
  });
});
