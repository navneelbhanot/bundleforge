/**
 * Vertical slice — custom bundle (M-068).
 * Free-form config; engine handles unknown rule types gracefully (zero
 * discount, not a throw) so a "custom" pricing strategy that hasn't
 * been wired up yet doesn't break the cart.
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

describe("vertical slice — custom bundle", () => {
  it("accepts free-form config and prices via custom rule (zero discount today)", async () => {
    repo.create.mockResolvedValueOnce({ id: "b-c", type: "custom" });
    const svc = new BundleService();
    await svc.create("shop", {
      title: "Custom Strategy",
      type: "custom",
      config: { something: "else", nested: { ok: true } },
      items: [{ shopifyProductGid: "gid://Product/X", title: "X", quantity: 1 }],
      pricingRules: [{ type: "custom", value: 0 }],
    });

    const input = buildPricingInput({
      bundleId: "b-c",
      currency: "USD",
      items: [{ id: "li", shopifyProductGid: "gid://Product/X", quantity: 1, unitPrice: "9.99" }],
      rules: [{ id: "r", type: "custom", value: "0", priority: 0, stackable: false }],
    });
    const r = computeBundlePrice(input);
    expect(r.applied).toEqual([]);
    expect(r.total.amount).toBe("9.99");
  });
});
