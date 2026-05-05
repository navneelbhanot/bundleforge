import { describe, it, expect, vi } from "vitest";

import {
  dispatchOrder,
  getAdapter,
  type IntegrationRow,
  type ShopIntegrationsLoader,
} from "./registry";

const order = {
  shopifyOrderGid: "gid://Order/1",
  shopifyOrderNumber: "#1001",
  bundleId: "b-1",
  currency: "USD",
  bundlePrice: "30.00",
  skuBreakdown: [
    {
      sku: "A",
      shopifyProductGid: "gid://Product/1",
      quantity: 2,
      title: "Widget",
    },
  ],
};

describe("integration registry", () => {
  it("returns the four built-in adapters", () => {
    expect(getAdapter("shipstation")?.type).toBe("shipstation");
    expect(getAdapter("amazon")?.type).toBe("amazon");
    expect(getAdapter("recharge")?.type).toBe("recharge");
    expect(getAdapter("bold")?.type).toBe("bold");
  });

  it("returns undefined for unknown types", () => {
    expect(getAdapter("klaviyo" as never)).toBeUndefined();
  });
});

describe("dispatchOrder", () => {
  it("walks all active integrations and reports per-adapter errors", async () => {
    // Plain JSON creds (no v1: prefix) so registry's decrypt branch is skipped.
    const rows: IntegrationRow[] = [
      {
        id: "i-amazon",
        type: "amazon",
        status: "active",
        credentials: JSON.stringify({ endpoint: "https://example.com/ok" }),
      },
      {
        id: "i-bold",
        type: "bold",
        status: "active",
        credentials: JSON.stringify({}),
      },
    ];
    const loader: ShopIntegrationsLoader = {
      list: vi.fn().mockResolvedValue(rows),
    };
    const result = await dispatchOrder("shop-1", order, loader);
    // Amazon adapter pushOrder is a stub that succeeds; Bold throws on
    // missing shopId in creds.
    expect(result.pushed).toBe(1);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].type).toBe("bold");
  });

  it("returns no errors when no integrations are configured", async () => {
    const loader: ShopIntegrationsLoader = {
      list: vi.fn().mockResolvedValue([]),
    };
    const r = await dispatchOrder("shop-1", order, loader);
    expect(r.pushed).toBe(0);
    expect(r.errors).toEqual([]);
  });
});
