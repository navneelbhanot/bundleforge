/**
 * Vertical slice — mystery bundle (M-065).
 * Opaque contents to the customer; pricing is a fixed discount.
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

describe("vertical slice — mystery bundle", () => {
  it("creates and prices with $10 fixed discount", async () => {
    repo.create.mockResolvedValueOnce({ id: "b-myst", type: "mystery" });
    const svc = new BundleService();
    await svc.create("shop", {
      title: "Mystery Box",
      type: "mystery",
      items: [{ shopifyProductGid: "gid://Product/M", title: "Mystery", quantity: 1 }],
      pricingRules: [{ type: "fixed", value: 10 }],
    });

    const input = buildPricingInput({
      bundleId: "b-myst",
      currency: "USD",
      items: [{ id: "li", shopifyProductGid: "gid://Product/M", quantity: 1, unitPrice: "30.00" }],
      rules: [{ id: "r", type: "fixed", value: "10.00", priority: 0, stackable: false }],
    });
    const r = computeBundlePrice(input);
    expect(r.total.amount).toBe("20.00");
  });
});
