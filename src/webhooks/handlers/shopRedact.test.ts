import { describe, it, expect, vi } from "vitest";

import { shopRedactHandler } from "./shopRedact";

describe("shopRedactHandler", () => {
  it("calls deleteMany with the correct shopDomain", async () => {
    const deleteMany = vi.fn().mockResolvedValue({ count: 1 });
    const handler = shopRedactHandler({ deleteMany });
    await handler({
      shopDomain: "demo.myshopify.com",
      webhookId: "wh-1",
      payload: { shop_id: 99, shop_domain: "demo.myshopify.com" },
    });
    expect(deleteMany).toHaveBeenCalledTimes(1);
    expect(deleteMany.mock.calls[0][0]).toEqual({
      where: { shopifyDomain: "demo.myshopify.com" },
    });
  });

  it("does not throw when shop is already absent", async () => {
    const deleteMany = vi.fn().mockResolvedValue({ count: 0 });
    const handler = shopRedactHandler({ deleteMany });
    await expect(
      handler({
        shopDomain: "missing.myshopify.com",
        webhookId: "wh-2",
        payload: {},
      }),
    ).resolves.toBeUndefined();
  });
});
