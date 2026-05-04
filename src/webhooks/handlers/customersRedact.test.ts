import { describe, it, expect } from "vitest";

import { customersRedactHandler } from "./customersRedact";

describe("customersRedactHandler", () => {
  it("does not throw on a typical payload", async () => {
    await expect(
      customersRedactHandler({
        shopDomain: "demo.myshopify.com",
        webhookId: "wh-1",
        payload: { customer: { id: 1, email: "x@y.com" }, shop_id: 99 },
      }),
    ).resolves.toBeUndefined();
  });

  it("does not throw on an empty payload", async () => {
    await expect(
      customersRedactHandler({
        shopDomain: "x.myshopify.com",
        webhookId: "wh-2",
        payload: {},
      }),
    ).resolves.toBeUndefined();
  });
});
