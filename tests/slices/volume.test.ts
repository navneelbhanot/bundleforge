/**
 * Vertical slice — volume bundle (M-058).
 * Volume rule: per-unit discount above a threshold quantity.
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

describe("vertical slice — volume bundle", () => {
  it("creates and prices: $1 off each unit at/beyond qty 5", async () => {
    repo.create.mockResolvedValueOnce({ id: "b-vol", type: "volume" });
    const svc = new BundleService();
    await svc.create("shop", {
      title: "Notebook Bulk",
      type: "volume",
      items: [
        { shopifyProductGid: "gid://Product/NB", title: "Notebook", quantity: 1 },
      ],
      pricingRules: [
        { type: "volume", value: 1, minQuantity: 5 },
      ],
    });

    const input = buildPricingInput({
      bundleId: "b-vol",
      currency: "USD",
      items: [
        { id: "li", shopifyProductGid: "gid://Product/NB", quantity: 8, unitPrice: "5.00" },
      ],
      rules: [
        { id: "r", type: "volume", value: "1.00", minQuantity: 5, priority: 0, stackable: false },
      ],
    });
    const r = computeBundlePrice(input);
    // 8 - 5 + 1 = 4 qualifying × $1 = $4 off; subtotal $40 → $36
    expect(r.subtotal.amount).toBe("40.00");
    expect(r.totalDiscount.amount).toBe("4.00");
    expect(r.total.amount).toBe("36.00");
  });

  it("below threshold: gate fails, no discount", async () => {
    const input = buildPricingInput({
      bundleId: "b-vol",
      currency: "USD",
      items: [{ id: "li", shopifyProductGid: "gid://x", quantity: 2, unitPrice: "5.00" }],
      rules: [
        { id: "r", type: "volume", value: "1.00", minQuantity: 5, priority: 0, stackable: false },
      ],
    });
    const r = computeBundlePrice(input);
    expect(r.applied).toEqual([]);
    expect(r.skipped[0].reason).toBe("min_quantity_not_met");
  });
});
