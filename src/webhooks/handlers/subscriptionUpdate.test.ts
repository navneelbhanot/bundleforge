import { describe, it, expect, vi } from "vitest";

import { subscriptionUpdateHandler } from "./subscriptionUpdate";

describe("subscriptionUpdateHandler", () => {
  it("maps active and sets activatedAt", async () => {
    const updateMany = vi.fn().mockResolvedValue({ count: 1 });
    const handler = subscriptionUpdateHandler({ updateMany });
    await handler({
      shopDomain: "demo.myshopify.com",
      webhookId: "wh-1",
      payload: {
        app_subscription: {
          admin_graphql_api_id: "gid://shopify/AppSubscription/1",
          status: "ACTIVE",
        },
      },
    });
    const args = updateMany.mock.calls[0][0];
    expect(args.where).toEqual({
      shopifyChargeId: "gid://shopify/AppSubscription/1",
    });
    expect(args.data.status).toBe("active");
    expect(args.data.activatedAt).toBeInstanceOf(Date);
  });

  it("maps cancelled and sets cancelledAt", async () => {
    const updateMany = vi.fn().mockResolvedValue({ count: 1 });
    const handler = subscriptionUpdateHandler({ updateMany });
    await handler({
      shopDomain: "demo.myshopify.com",
      webhookId: "wh-2",
      payload: {
        app_subscription: {
          admin_graphql_api_id: "gid://shopify/AppSubscription/1",
          status: "cancelled",
        },
      },
    });
    const data = updateMany.mock.calls[0][0].data;
    expect(data.status).toBe("cancelled");
    expect(data.cancelledAt).toBeInstanceOf(Date);
  });

  it("maps both spellings of canceled to cancelled", async () => {
    const updateMany = vi.fn().mockResolvedValue({ count: 1 });
    const handler = subscriptionUpdateHandler({ updateMany });
    await handler({
      shopDomain: "x.myshopify.com",
      webhookId: "wh-3",
      payload: {
        app_subscription: {
          admin_graphql_api_id: "gid://A/1",
          status: "canceled",
        },
      },
    });
    expect(updateMany.mock.calls[0][0].data.status).toBe("cancelled");
  });

  it("does not call updateMany when payload is missing fields", async () => {
    const updateMany = vi.fn();
    const handler = subscriptionUpdateHandler({ updateMany });
    await handler({
      shopDomain: "x.myshopify.com",
      webhookId: "wh-4",
      payload: {},
    });
    expect(updateMany).not.toHaveBeenCalled();
  });
});
