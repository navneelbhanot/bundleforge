/**
 * Vertical slice — multipack (M-057).
 *
 * Multipack is a single SKU with packQuantity. Pricing is typically
 * a fixed or percentage discount on the pack as a whole.
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

describe("vertical slice — multipack", () => {
  it("config validates packQuantity, prices a 6-pack with 15% off", async () => {
    repo.create.mockResolvedValueOnce({ id: "b-mp", type: "multipack" });
    const svc = new BundleService();
    await svc.create("shop", {
      title: "6-pack Soda",
      type: "multipack",
      config: { packQuantity: 6 },
      items: [
        { shopifyProductGid: "gid://Product/Soda", title: "Soda", quantity: 1 },
      ],
      pricingRules: [{ type: "percentage", value: 15 }],
    });

    const input = buildPricingInput({
      bundleId: "b-mp",
      currency: "USD",
      items: [
        { id: "li", shopifyProductGid: "gid://Product/Soda", quantity: 6, unitPrice: "2.00" },
      ],
      rules: [{ id: "r", type: "percentage", value: "15", priority: 0, stackable: false }],
    });
    const r = computeBundlePrice(input);
    // 6 × $2 = $12; 15% off = $1.80; total $10.20
    expect(r.subtotal.amount).toBe("12.00");
    expect(r.totalDiscount.amount).toBe("1.80");
    expect(r.total.amount).toBe("10.20");
  });

  it("rejects multipack without packQuantity", async () => {
    const svc = new BundleService();
    await expect(
      svc.create("shop", {
        title: "Bad Pack",
        type: "multipack",
        config: {},
        items: [],
        pricingRules: [],
      }),
    ).rejects.toThrow();
  });
});
