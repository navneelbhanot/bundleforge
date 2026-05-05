import { describe, it, expect, vi } from "vitest";

import { appUninstalledHandler } from "./appUninstalled";

describe("appUninstalledHandler", () => {
  it("calls updateMany with the correct shopDomain and a fresh Date", async () => {
    const updateMany = vi.fn().mockResolvedValue({ count: 1 });
    const handler = appUninstalledHandler({ updateMany });
    const before = new Date();
    await handler({
      shopDomain: "demo.myshopify.com",
      payload: {},
      webhookId: "wh-1",
    });
    expect(updateMany).toHaveBeenCalledTimes(1);
    const args = updateMany.mock.calls[0][0];
    expect(args.where).toEqual({ shopifyDomain: "demo.myshopify.com" });
    expect(args.data.uninstalledAt).toBeInstanceOf(Date);
    expect(args.data.uninstalledAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
  });

  it("does not throw when no rows match", async () => {
    const updateMany = vi.fn().mockResolvedValue({ count: 0 });
    const handler = appUninstalledHandler({ updateMany });
    await expect(
      handler({
        shopDomain: "unknown.myshopify.com",
        payload: {},
        webhookId: "wh-2",
      }),
    ).resolves.toBeUndefined();
  });
});
