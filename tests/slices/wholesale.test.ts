/**
 * Vertical slice — wholesale bundle (M-067).
 * Volume rule + minWholesaleQuantity gate.
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

describe("vertical slice — wholesale bundle", () => {
  it("creates with minWholesaleQuantity in config and applies volume pricing", async () => {
    repo.create.mockResolvedValueOnce({ id: "b-w", type: "wholesale" });
    const svc = new BundleService();
    await svc.create("shop", {
      title: "Wholesale Pallet",
      type: "wholesale",
      config: { minWholesaleQuantity: 50 },
      items: [{ shopifyProductGid: "gid://Product/Pallet", title: "Pallet", quantity: 1 }],
      pricingRules: [{ type: "volume", value: 0.5, minQuantity: 50 }],
    });

    const input = buildPricingInput({
      bundleId: "b-w",
      currency: "USD",
      items: [{ id: "li", shopifyProductGid: "gid://Product/Pallet", quantity: 60, unitPrice: "10.00" }],
      rules: [{ id: "r", type: "volume", value: "0.50", minQuantity: 50, priority: 0, stackable: false }],
    });
    const r = computeBundlePrice(input);
    // qualifying = 60 - 50 + 1 = 11 units × $0.50 = $5.50
    expect(r.subtotal.amount).toBe("600.00");
    expect(r.totalDiscount.amount).toBe("5.50");
  });
});
