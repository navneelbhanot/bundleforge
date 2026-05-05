import { describe, it, expect, vi } from "vitest";

import { shopUpdateHandler } from "./shopUpdate";

describe("shopUpdateHandler", () => {
  it("maps the recognized payload fields", async () => {
    const updateMany = vi.fn().mockResolvedValue({ count: 1 });
    const handler = shopUpdateHandler({ updateMany });
    await handler({
      shopDomain: "demo.myshopify.com",
      webhookId: "wh-1",
      payload: {
        name: "Demo Co",
        email: "owner@example.com",
        currency: "USD",
        iana_timezone: "America/New_York",
        plan_name: "shopify_plus",
        primary_locale: "en",
        random_extra_field: "ignored",
      },
    });
    expect(updateMany).toHaveBeenCalledTimes(1);
    expect(updateMany.mock.calls[0][0]).toEqual({
      where: { shopifyDomain: "demo.myshopify.com" },
      data: {
        name: "Demo Co",
        email: "owner@example.com",
        currency: "USD",
        timezone: "America/New_York",
        shopifyPlan: "shopify_plus",
        locale: "en",
      },
    });
  });

  it("does not call updateMany when no recognized fields are present", async () => {
    const updateMany = vi.fn();
    const handler = shopUpdateHandler({ updateMany });
    await handler({ shopDomain: "x.myshopify.com", webhookId: "wh-2", payload: {} });
    expect(updateMany).not.toHaveBeenCalled();
  });

  it("ignores fields with wrong types", async () => {
    const updateMany = vi.fn().mockResolvedValue({ count: 1 });
    const handler = shopUpdateHandler({ updateMany });
    await handler({
      shopDomain: "x.myshopify.com",
      webhookId: "wh-3",
      payload: { name: 42, email: "ok@example.com" },
    });
    expect(updateMany.mock.calls[0][0].data).toEqual({ email: "ok@example.com" });
  });
});
