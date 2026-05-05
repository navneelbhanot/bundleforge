/**
 * Vertical slice — BOGO (M-060). Buy X get Y free; cheapest go free.
 */
import { describe, it, expect, vi } from "vitest";

vi.mock("../../src/services/bundles/repository", () => ({
  bundleRepo: {
    list: vi.fn(),
    findById: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    softDelete: vi.fn(),
  },
}));

import { BundleService } from "../../src/services/bundles";
import { computeBundlePrice } from "../../src/services/pricing/engine";
import { bundleRepo } from "../../src/services/bundles/repository";
import { buildPricingInput } from "./buildPricingInput";

const repo = bundleRepo as unknown as Record<string, ReturnType<typeof vi.fn>>;

describe("vertical slice — BOGO", () => {
  it("create + price: buy 2 get 1 free, qty 6 → 2 free at cheapest", async () => {
    repo.create.mockResolvedValueOnce({ id: "b-bogo", type: "bogo" });
    const svc = new BundleService();
    await svc.create("shop", {
      title: "Buy 2 Get 1",
      type: "bogo",
      items: [
        { shopifyProductGid: "gid://Product/Cheap", title: "Cheap", quantity: 1 },
        { shopifyProductGid: "gid://Product/Pricey", title: "Pricey", quantity: 1 },
      ],
      pricingRules: [{ type: "bogo", value: 1, minQuantity: 2 }],
    });

    const input = buildPricingInput({
      bundleId: "b-bogo",
      currency: "USD",
      items: [
        { id: "li-c", shopifyProductGid: "gid://Product/Cheap",  quantity: 3, unitPrice: "5.00" },
        { id: "li-p", shopifyProductGid: "gid://Product/Pricey", quantity: 3, unitPrice: "10.00" },
      ],
      rules: [{ id: "r", type: "bogo", value: "1", minQuantity: 2, priority: 0, stackable: false }],
    });
    const r = computeBundlePrice(input);
    // 6 units / set size 3 = 2 sets → 2 free units at $5 each = $10
    expect(r.subtotal.amount).toBe("45.00");
    expect(r.totalDiscount.amount).toBe("10.00");
    expect(r.total.amount).toBe("35.00");
  });

  it("not enough items for one set: no discount", async () => {
    const input = buildPricingInput({
      bundleId: "b-bogo",
      currency: "USD",
      items: [{ id: "li", shopifyProductGid: "gid://x", quantity: 2, unitPrice: "5.00" }],
      rules: [{ id: "r", type: "bogo", value: "1", minQuantity: 2, priority: 0, stackable: false }],
    });
    const r = computeBundlePrice(input);
    expect(r.applied).toEqual([]);
  });
});
