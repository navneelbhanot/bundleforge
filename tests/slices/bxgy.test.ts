/**
 * Vertical slice — BXGY (M-061).
 * Buy X items from one set, get Y items from another set free.
 * Uses the same `bogo` rule semantics today; per-set partitioning is a
 * future enhancement when richer item targeting lands.
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

describe("vertical slice — BXGY", () => {
  it("buy 3, get 1 of cheaper item free; qty=8 -> 2 free at cheapest", async () => {
    repo.create.mockResolvedValueOnce({ id: "b-bxgy", type: "bxgy" });
    const svc = new BundleService();
    await svc.create("shop", {
      title: "BXGY 3+1",
      type: "bxgy",
      items: [
        { shopifyProductGid: "gid://Product/Main", title: "Main", quantity: 1 },
        { shopifyProductGid: "gid://Product/Free", title: "Free", quantity: 1 },
      ],
      pricingRules: [{ type: "bogo", value: 1, minQuantity: 3 }],
    });

    const input = buildPricingInput({
      bundleId: "b-bxgy",
      currency: "USD",
      items: [
        { id: "li-m", shopifyProductGid: "gid://Product/Main", quantity: 6, unitPrice: "20.00" },
        { id: "li-f", shopifyProductGid: "gid://Product/Free", quantity: 2, unitPrice: "5.00" },
      ],
      rules: [{ id: "r", type: "bogo", value: "1", minQuantity: 3, priority: 0, stackable: false }],
    });
    const r = computeBundlePrice(input);
    // 8 / setSize 4 = 2 sets -> 2 free at cheapest = $5 + $5 = $10
    expect(r.subtotal.amount).toBe("130.00");
    expect(r.totalDiscount.amount).toBe("10.00");
    expect(r.total.amount).toBe("120.00");
  });
});
