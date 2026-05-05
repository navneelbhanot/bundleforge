import { describe, it, expect } from "vitest";

import { breakdownBundleSkus } from "./skuBreakdown";

describe("breakdownBundleSkus", () => {
  it("multiplies item quantity × bundles sold", () => {
    const r = breakdownBundleSkus(
      [
        { sku: "A", shopifyProductGid: "gid://1", quantity: 1 },
        { sku: "B", shopifyProductGid: "gid://2", quantity: 2 },
      ],
      3,
    );
    expect(r).toEqual([
      { sku: "A", shopifyProductGid: "gid://1", shopifyVariantGid: null, title: null, quantity: 3 },
      { sku: "B", shopifyProductGid: "gid://2", shopifyVariantGid: null, title: null, quantity: 6 },
    ]);
  });

  it("returns empty when bundlesSold is 0 or negative", () => {
    expect(breakdownBundleSkus([{ sku: "A", shopifyProductGid: "x", quantity: 1 }], 0)).toEqual([]);
    expect(breakdownBundleSkus([{ sku: "A", shopifyProductGid: "x", quantity: 1 }], -1)).toEqual([]);
  });

  it("preserves variant gid and title when present", () => {
    const r = breakdownBundleSkus(
      [{ sku: null, shopifyProductGid: "gid://x", shopifyVariantGid: "gid://v", title: "T", quantity: 1 }],
      2,
    );
    expect(r[0].shopifyVariantGid).toBe("gid://v");
    expect(r[0].title).toBe("T");
    expect(r[0].sku).toBe(null);
  });
});
