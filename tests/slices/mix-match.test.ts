/**
 * Vertical slice — mix-and-match (M-059).
 * Customer picks from a set of items; bundle defines min/max.
 * Pricing typically a percentage off the basket of selected items.
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

describe("vertical slice — mix-and-match", () => {
  it("creates with min/max validated, prices 4-item basket with 20% off", async () => {
    repo.create.mockResolvedValueOnce({ id: "b-mm", type: "mix_match" });
    const svc = new BundleService();
    await svc.create("shop", {
      title: "Pick 4",
      type: "mix_match",
      config: { minItems: 4, maxItems: 4, allowDuplicates: false },
      items: [
        { shopifyProductGid: "gid://Product/A", title: "A", quantity: 1, isRequired: false },
        { shopifyProductGid: "gid://Product/B", title: "B", quantity: 1, isRequired: false },
        { shopifyProductGid: "gid://Product/C", title: "C", quantity: 1, isRequired: false },
        { shopifyProductGid: "gid://Product/D", title: "D", quantity: 1, isRequired: false },
      ],
      pricingRules: [{ type: "percentage", value: 20, minQuantity: 4 }],
    });

    const input = buildPricingInput({
      bundleId: "b-mm",
      currency: "USD",
      items: [
        { id: "li-a", shopifyProductGid: "gid://Product/A", quantity: 1, unitPrice: "5.00" },
        { id: "li-b", shopifyProductGid: "gid://Product/B", quantity: 1, unitPrice: "10.00" },
        { id: "li-c", shopifyProductGid: "gid://Product/C", quantity: 1, unitPrice: "15.00" },
        { id: "li-d", shopifyProductGid: "gid://Product/D", quantity: 1, unitPrice: "20.00" },
      ],
      rules: [
        { id: "r", type: "percentage", value: "20", minQuantity: 4, priority: 0, stackable: false },
      ],
    });
    const r = computeBundlePrice(input);
    // subtotal $50, 20% = $10, total $40
    expect(r.subtotal.amount).toBe("50.00");
    expect(r.totalDiscount.amount).toBe("10.00");
    expect(r.total.amount).toBe("40.00");
  });

  it("rejects mix_match config with maxItems < minItems", async () => {
    const svc = new BundleService();
    await expect(
      svc.create("shop", {
        title: "Bad Pick",
        type: "mix_match",
        config: { minItems: 5, maxItems: 2 },
        items: [],
        pricingRules: [],
      }),
    ).rejects.toThrow();
  });
});
