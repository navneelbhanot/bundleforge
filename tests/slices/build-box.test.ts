/**
 * Vertical slice — build-a-box (M-062).
 * Customer picks N items across guided steps; pricing is a percentage
 * off when minQuantity met.
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

describe("vertical slice — build-a-box", () => {
  it("creates with steps + minItems/maxItems; prices 25% off", async () => {
    repo.create.mockResolvedValueOnce({ id: "b-bb", type: "build_box" });
    const svc = new BundleService();
    await svc.create("shop", {
      title: "Custom Box",
      type: "build_box",
      config: {
        minItems: 4,
        maxItems: 4,
        allowDuplicates: false,
        steps: [
          { name: "Step 1: Pick a base", pickCount: 1 },
          { name: "Step 2: Pick 3 toppings", pickCount: 3 },
        ],
      },
      items: [],
      pricingRules: [{ type: "percentage", value: 25, minQuantity: 4 }],
    });

    const input = buildPricingInput({
      bundleId: "b-bb",
      currency: "USD",
      items: [
        { id: "1", shopifyProductGid: "gid://x", quantity: 1, unitPrice: "8.00" },
        { id: "2", shopifyProductGid: "gid://y", quantity: 1, unitPrice: "4.00" },
        { id: "3", shopifyProductGid: "gid://z", quantity: 1, unitPrice: "4.00" },
        { id: "4", shopifyProductGid: "gid://w", quantity: 1, unitPrice: "4.00" },
      ],
      rules: [{ id: "r", type: "percentage", value: "25", minQuantity: 4, priority: 0, stackable: false }],
    });
    const r = computeBundlePrice(input);
    expect(r.subtotal.amount).toBe("20.00");
    expect(r.totalDiscount.amount).toBe("5.00");
    expect(r.total.amount).toBe("15.00");
  });

  it("rejects build_box step with non-positive pickCount", async () => {
    const svc = new BundleService();
    await expect(
      svc.create("shop", {
        title: "Bad",
        type: "build_box",
        config: {
          minItems: 1,
          maxItems: 4,
          steps: [{ name: "Bad", pickCount: 0 }],
        },
        items: [],
        pricingRules: [],
      }),
    ).rejects.toThrow();
  });
});
