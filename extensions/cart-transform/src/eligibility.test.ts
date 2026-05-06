import { describe, it, expect } from "vitest";

import { isEligible, inventoryAllowsExpand, run } from "./run.js";

describe("isEligible (M-172b)", () => {
  const ctxAnon = { customerId: null, country: "US", language: "en" };
  const ctxLoggedIn = {
    customerId: "gid://shopify/Customer/1",
    country: "US",
    language: "en",
  };

  it("no metafield → eligible", () => {
    expect(isEligible(null, ctxAnon)).toBe(true);
    expect(isEligible({}, ctxAnon)).toBe(true);
  });

  it("requireLogin=true blocks anonymous customers", () => {
    expect(isEligible({ requireLogin: true }, ctxAnon)).toBe(false);
    expect(isEligible({ requireLogin: true }, ctxLoggedIn)).toBe(true);
  });

  it("markets=['US'] + country=US → eligible", () => {
    expect(isEligible({ markets: ["US"] }, ctxAnon)).toBe(true);
  });

  it("markets=['US'] + country=CA → not eligible", () => {
    expect(
      isEligible(
        { markets: ["US"] },
        { customerId: null, country: "CA", language: "en" },
      ),
    ).toBe(false);
  });

  it("locales=['en'] + language=fr → not eligible", () => {
    expect(
      isEligible(
        { locales: ["en"] },
        { customerId: null, country: "US", language: "fr" },
      ),
    ).toBe(false);
  });

  it("multiple rules: all must pass", () => {
    const blob = {
      requireLogin: true,
      markets: ["US", "CA"],
      locales: ["en"],
    };
    expect(isEligible(blob, ctxLoggedIn)).toBe(true);
    expect(isEligible(blob, ctxAnon)).toBe(false);
    expect(
      isEligible(blob, { ...ctxLoggedIn, language: "fr" }),
    ).toBe(false);
  });
});

describe("inventoryAllowsExpand (M-173b)", () => {
  it("no rules → allow expand", () => {
    expect(inventoryAllowsExpand(null)).toBe(true);
    expect(inventoryAllowsExpand({})).toBe(true);
  });

  it("componentOnlyMode=true → block expand", () => {
    expect(inventoryAllowsExpand({ componentOnlyMode: true })).toBe(false);
  });

  it("componentOnlyMode=false → allow expand", () => {
    expect(inventoryAllowsExpand({ componentOnlyMode: false })).toBe(true);
  });

  it("other rules don't block (informational only in CTF)", () => {
    expect(
      inventoryAllowsExpand({
        lowStockThreshold: 5,
        oversellPolicy: "prevent",
        pauseWhenComponentBelow: 3,
      }),
    ).toBe(true);
  });
});

describe("run() — expand-path with eligibility (M-172b/173b)", () => {
  function bundleLine(opts) {
    return {
      id: opts.id ?? "gid://shopify/CartLine/1",
      quantity: 1,
      cost: { amountPerQuantity: { amount: "20", currencyCode: "USD" } },
      bundleforgeBundleId: null,
      bundleforgeRules: null,
      merchandise: {
        id: "gid://shopify/ProductVariant/100",
        product: {
          id: "gid://shopify/Product/200",
          isBundleMetafield: { value: "true" },
          componentsMetafield: {
            value: JSON.stringify({
              schemaVersion: 1,
              bundleId: opts.bundleId ?? "b-1",
              components: [
                { variantGid: "gid://shopify/ProductVariant/A", quantity: 1 },
                { variantGid: "gid://shopify/ProductVariant/B", quantity: 1 },
              ],
            }),
          },
          eligibilityMetafield: opts.eligibility
            ? { value: JSON.stringify(opts.eligibility) }
            : null,
          inventoryRulesMetafield: opts.inventoryRules
            ? { value: JSON.stringify(opts.inventoryRules) }
            : null,
        },
      },
    };
  }

  function makeInput(line, ctx = {}) {
    return {
      cart: {
        lines: [line],
        buyerIdentity: ctx.customerId
          ? { customer: { id: ctx.customerId } }
          : { customer: null },
      },
      presentmentCurrencyRate: "1",
      localization: {
        country: { isoCode: ctx.country ?? "US" },
        language: { isoCode: ctx.language ?? "en" },
      },
      shop: { cartDefaultModeMetafield: null },
    };
  }

  it("eligibility: country mismatch → no expand operation", () => {
    const line = bundleLine({
      eligibility: { markets: ["CA"] },
    });
    const result = run(makeInput(line, { country: "US" }));
    expect(result.operations).toEqual([]);
  });

  it("eligibility: country match → expand fires", () => {
    const line = bundleLine({ eligibility: { markets: ["US"] } });
    const result = run(makeInput(line, { country: "US" }));
    expect(result.operations).toHaveLength(1);
    expect(result.operations[0].expand).toBeTruthy();
  });

  it("inventoryRules.componentOnlyMode=true → no expand", () => {
    const line = bundleLine({
      inventoryRules: { componentOnlyMode: true },
    });
    const result = run(makeInput(line));
    expect(result.operations).toEqual([]);
  });

  it("no metafields → expand fires (default behavior)", () => {
    const line = bundleLine({});
    const result = run(makeInput(line));
    expect(result.operations).toHaveLength(1);
    expect(result.operations[0].expand).toBeTruthy();
  });
});
