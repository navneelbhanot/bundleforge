import { describe, it, expect } from "vitest";

import { convertKaching } from "./kaching";

describe("convertKaching", () => {
  it("maps a volume offer with a tier ladder", () => {
    const r = convertKaching([
      {
        name: "Volume Pack",
        offerType: "volume",
        products: [{ gid: "gid://Product/A", qty: 1 }],
        tiers: [
          { minQty: 3, percent: 5 },
          { minQty: 5, percent: 10 },
          { minQty: 10, percent: 20 },
        ],
      },
    ]);
    expect(r.errors).toEqual([]);
    expect(r.bundles[0].type).toBe("volume");
    expect(r.bundles[0].pricingRules).toHaveLength(3);
    expect(r.bundles[0].pricingRules[0].type).toBe("tiered");
    expect(r.bundles[0].pricingRules[2].minQuantity).toBe(10);
    expect(r.bundles[0].pricingRules[2].priority).toBe(3);
  });

  it("maps a non-volume offer to fixed", () => {
    const r = convertKaching([
      {
        name: "Starter",
        offerType: "bundle",
        products: [{ gid: "gid://x", qty: 2 }],
      },
    ]);
    expect(r.bundles[0].type).toBe("fixed");
    expect(r.bundles[0].items[0].quantity).toBe(2);
  });

  it("captures missing-name error", () => {
    const r = convertKaching([{ offerType: "bundle" }]);
    expect(r.errors).toHaveLength(1);
  });

  it("ignores tiers with zero or non-numeric percent", () => {
    const r = convertKaching([
      {
        name: "X",
        offerType: "volume",
        products: [],
        tiers: [{ minQty: 3, percent: 0 }, { minQty: 5 }],
      },
    ]);
    expect(r.bundles[0].pricingRules).toHaveLength(0);
  });
});
