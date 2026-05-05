import { describe, it, expect, vi } from "vitest";

import { ordersUpdatedHandler } from "./ordersUpdated";

function fakeClient(): {
  bundleOrder: { updateMany: ReturnType<typeof vi.fn> };
  shop: { findUnique: ReturnType<typeof vi.fn> };
} {
  return {
    bundleOrder: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
    shop: { findUnique: vi.fn().mockResolvedValue({ id: "shop-uuid" }) },
  };
}

describe("ordersUpdatedHandler", () => {
  it("maps fulfillment_status='fulfilled' onto BundleOrder", async () => {
    const client = fakeClient();
    const handler = ordersUpdatedHandler({ client });
    await handler({
      shopDomain: "demo.myshopify.com",
      webhookId: "wh-1",
      payload: {
        admin_graphql_api_id: "gid://Order/1",
        fulfillment_status: "fulfilled",
      },
    });
    const args = client.bundleOrder.updateMany.mock.calls[0][0];
    expect(args.data.fulfillmentStatus).toBe("fulfilled");
    expect(args.data.status).toBe("fulfilled");
  });

  it("maps partial fulfillment", async () => {
    const client = fakeClient();
    const handler = ordersUpdatedHandler({ client });
    await handler({
      shopDomain: "demo.myshopify.com",
      webhookId: "wh-2",
      payload: {
        admin_graphql_api_id: "gid://Order/1",
        fulfillment_status: "partial",
      },
    });
    expect(client.bundleOrder.updateMany.mock.calls[0][0].data.fulfillmentStatus).toBe(
      "partial",
    );
  });

  it("maps null fulfillment to unfulfilled", async () => {
    const client = fakeClient();
    const handler = ordersUpdatedHandler({ client });
    await handler({
      shopDomain: "demo.myshopify.com",
      webhookId: "wh-3",
      payload: {
        admin_graphql_api_id: "gid://Order/1",
        fulfillment_status: null,
      },
    });
    expect(client.bundleOrder.updateMany.mock.calls[0][0].data.fulfillmentStatus).toBe(
      "unfulfilled",
    );
  });

  it("noops when GID missing", async () => {
    const client = fakeClient();
    const handler = ordersUpdatedHandler({ client });
    await handler({ shopDomain: "x", webhookId: "wh-4", payload: {} });
    expect(client.bundleOrder.updateMany).not.toHaveBeenCalled();
  });
});
