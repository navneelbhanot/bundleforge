import { describe, it, expect } from "vitest";

import { convertSimpleBundles } from "./simpleBundles";

describe("convertSimpleBundles", () => {
  it("maps a mix_match bundle with components and rules", () => {
    const r = convertSimpleBundles([
      {
        name: "Pick 3",
        bundleType: "mix_match",
        config: { minItems: 3, maxItems: 3 },
        components: [
          { productGid: "gid://Product/A", qty: 1, sku: "A" },
          { productGid: "gid://Product/B", qty: 1, sku: "B" },
        ],
        pricingRules: [{ type: "percentage", value: 15, minQty: 3 }],
      },
    ]);
    expect(r.errors).toEqual([]);
    expect(r.bundles[0].type).toBe("mix_match");
    expect(r.bundles[0].items).toHaveLength(2);
    expect(r.bundles[0].pricingRules[0].type).toBe("percentage");
    expect(r.bundles[0].pricingRules[0].minQuantity).toBe(3);
  });

  it("falls back to fixed type for unknown bundleType", () => {
    const r = convertSimpleBundles([
      {
        name: "X",
        bundleType: "exotic",
        components: [{ productGid: "gid://x", qty: 1 }],
      },
    ]);
    expect(r.bundles[0].type).toBe("fixed");
  });

  it("captures missing-name as a per-row error", () => {
    const r = convertSimpleBundles([{ bundleType: "fixed" }]);
    expect(r.errors).toHaveLength(1);
  });
});
