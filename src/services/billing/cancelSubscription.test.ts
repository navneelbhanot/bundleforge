import { describe, it, expect, vi } from "vitest";
import type { Session } from "@shopify/shopify-api";

import { cancelSubscription } from "./cancelSubscription";

const session = { shop: "demo.myshopify.com" } as unknown as Session;

function fakeGraphql(response: unknown): typeof import("../../shopify/graphql").shopifyGraphql {
  return (async () => response) as unknown as typeof import("../../shopify/graphql").shopifyGraphql;
}

describe("cancelSubscription", () => {
  it("calls the mutation and updates BillingSubscription to cancelled", async () => {
    const updateMany = vi.fn().mockResolvedValue({ count: 1 });
    const result = await cancelSubscription({
      session,
      chargeId: "gid://A/1",
      graphql: fakeGraphql({
        appSubscriptionCancel: {
          appSubscription: { id: "gid://A/1", status: "CANCELLED" },
          userErrors: [],
        },
      }),
      client: { updateMany },
    });
    expect(result.status).toBe("CANCELLED");
    const call = updateMany.mock.calls[0][0];
    expect(call.where).toEqual({ shopifyChargeId: "gid://A/1" });
    expect(call.data.status).toBe("cancelled");
    expect(call.data.cancelledAt).toBeInstanceOf(Date);
  });

  it("throws on userErrors", async () => {
    await expect(
      cancelSubscription({
        session,
        chargeId: "gid://A/1",
        graphql: fakeGraphql({
          appSubscriptionCancel: {
            appSubscription: null,
            userErrors: [{ field: ["id"], message: "Charge not found" }],
          },
        }),
        client: { updateMany: vi.fn() },
      }),
    ).rejects.toThrow(/Charge not found/);
  });
});
