import { describe, it, expect } from "vitest";

import { convertShopifyBundles } from "./shopifyBundles";

describe("convertShopifyBundles", () => {
  it("maps a fixed bundle from Shopify Bundle product JSON", () => {
    const r = convertShopifyBundles([
      {
        id: 12345,
        title: "Camp Box",
        handle: "camp-box",
        bundleComponents: [
          {
            componentProduct: { admin_graphql_api_id: "gid://Product/1" },
            quantity: 2,
            title: "Tent",
          },
          {
            componentProduct: { admin_graphql_api_id: "gid://Product/2" },
            quantity: 1,
            title: "Stove",
          },
        ],
      },
    ]);
    expect(r.errors).toEqual([]);
    expect(r.bundles).toHaveLength(1);
    expect(r.bundles[0].title).toBe("Camp Box");
    expect(r.bundles[0].type).toBe("fixed");
    expect(r.bundles[0].items).toHaveLength(2);
    expect(r.bundles[0].items[0].shopifyProductGid).toBe("gid://Product/1");
  });

  it("captures errors per row without aborting", () => {
    const r = convertShopifyBundles([
      { title: "ok", bundleComponents: [{ componentProduct: { id: "1" }, quantity: 1 }] },
      { title: "" }, // bad
    ]);
    expect(r.bundles).toHaveLength(1);
    expect(r.errors).toHaveLength(1);
    expect(r.errors[0].index).toBe(1);
  });

  it("returns empty arrays for non-array input", () => {
    expect(convertShopifyBundles(null)).toEqual({ bundles: [], errors: [] });
    expect(convertShopifyBundles({})).toEqual({ bundles: [], errors: [] });
  });
});
