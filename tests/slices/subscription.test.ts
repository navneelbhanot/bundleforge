/**
 * Vertical slice — subscription bundle (M-063).
 *
 * Pricing is a flat fixed discount today. Recharge / Bold / Seal
 * integration arrives at M-119+; until then the slice asserts the
 * service accepts the type tag and prices like a fixed bundle.
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

describe("vertical slice — subscription bundle", () => {
  it("accepts subscription type and prices with a $5 fixed discount", async () => {
    repo.create.mockResolvedValueOnce({ id: "b-sub", type: "subscription" });
    const svc = new BundleService();
    await svc.create("shop", {
      title: "Monthly Coffee Box",
      type: "subscription",
      items: [
        { shopifyProductGid: "gid://Product/Coffee", title: "Coffee", quantity: 2 },
      ],
      pricingRules: [{ type: "fixed", value: 5 }],
    });

    const input = buildPricingInput({
      bundleId: "b-sub",
      currency: "USD",
      items: [{ id: "li", shopifyProductGid: "gid://Product/Coffee", quantity: 2, unitPrice: "12.00" }],
      rules: [{ id: "r", type: "fixed", value: "5.00", priority: 0, stackable: false }],
    });
    const r = computeBundlePrice(input);
    expect(r.subtotal.amount).toBe("24.00");
    expect(r.total.amount).toBe("19.00");
  });
});
