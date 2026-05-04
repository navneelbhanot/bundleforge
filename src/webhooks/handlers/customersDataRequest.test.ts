import { describe, it, expect } from "vitest";

import { customersDataRequestHandler } from "./customersDataRequest";

describe("customersDataRequestHandler", () => {
  it("does not throw on a typical payload", async () => {
    await expect(
      customersDataRequestHandler({
        shopDomain: "demo.myshopify.com",
        webhookId: "wh-1",
        payload: { customer: { id: 1 }, shop_id: 99, orders_requested: [101, 102] },
      }),
    ).resolves.toBeUndefined();
  });

  it("does not throw on an empty payload", async () => {
    await expect(
      customersDataRequestHandler({
        shopDomain: "x.myshopify.com",
        webhookId: "wh-2",
        payload: {},
      }),
    ).resolves.toBeUndefined();
  });
});
