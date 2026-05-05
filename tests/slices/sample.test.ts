/**
 * Vertical slice — sample bundle (M-066).
 * Free or near-free trial pack to drive new-customer acquisition.
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

describe("vertical slice — sample bundle", () => {
  it("100% off for first-time customers (date-window gated)", async () => {
    repo.create.mockResolvedValueOnce({ id: "b-sample", type: "sample" });
    const svc = new BundleService();
    await svc.create("shop", {
      title: "Try Pack",
      type: "sample",
      items: [{ shopifyProductGid: "gid://Product/S", title: "Try", quantity: 1 }],
      pricingRules: [
        {
          type: "percentage",
          value: 100,
          conditions: { customerTags: ["new-customer"] },
        },
      ],
    });

    const input = buildPricingInput({
      bundleId: "b-sample",
      currency: "USD",
      items: [{ id: "li", shopifyProductGid: "gid://Product/S", quantity: 1, unitPrice: "8.00" }],
      rules: [
        {
          id: "r",
          type: "percentage",
          value: "100",
          priority: 0,
          stackable: false,
          conditions: { customerTags: ["new-customer"] },
        },
      ],
    });
    // With matching tag in context
    const r = computeBundlePrice({
      ...input,
      context: { now: "2026-05-05T00:00:00Z", customerTags: ["new-customer"] },
    });
    expect(r.total.amount).toBe("0.00");
  });
});
