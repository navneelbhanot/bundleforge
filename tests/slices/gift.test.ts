/**
 * Vertical slice — gift bundle (M-064).
 * 100% off promotional pack.
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

describe("vertical slice — gift bundle", () => {
  it("100% off → total = 0", async () => {
    repo.create.mockResolvedValueOnce({ id: "b-gift", type: "gift" });
    const svc = new BundleService();
    await svc.create("shop", {
      title: "Welcome Gift",
      type: "gift",
      items: [{ shopifyProductGid: "gid://Product/G", title: "Gift", quantity: 1 }],
      pricingRules: [{ type: "percentage", value: 100 }],
    });

    const input = buildPricingInput({
      bundleId: "b-gift",
      currency: "USD",
      items: [{ id: "li", shopifyProductGid: "gid://Product/G", quantity: 1, unitPrice: "25.00" }],
      rules: [{ id: "r", type: "percentage", value: "100", priority: 0, stackable: false }],
    });
    const r = computeBundlePrice(input);
    expect(r.total.amount).toBe("0.00");
    expect(r.totalDiscount.amount).toBe("25.00");
  });
});
