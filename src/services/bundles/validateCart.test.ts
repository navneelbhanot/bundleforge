import { describe, it, expect } from "vitest";

import { validateCart } from "./validateCart";

describe("validateCart", () => {
  it("rejects empty cart", () => {
    const r = validateCart(
      { type: "fixed", config: {} },
      [],
    );
    expect(r.valid).toBe(false);
  });

  it("mix_match: enforces min/max", () => {
    const cfg = { type: "mix_match", config: { minItems: 2, maxItems: 4 } };
    expect(
      validateCart(cfg, [{ shopifyProductGid: "a", quantity: 1 }]).valid,
    ).toBe(false);
    expect(
      validateCart(cfg, [
        { shopifyProductGid: "a", quantity: 2 },
        { shopifyProductGid: "b", quantity: 1 },
      ]).valid,
    ).toBe(true);
    expect(
      validateCart(cfg, [
        { shopifyProductGid: "a", quantity: 5 },
      ]).valid,
    ).toBe(false);
  });

  it("mix_match: rejects duplicates when allowDuplicates=false", () => {
    const cfg = {
      type: "mix_match",
      config: { minItems: 1, maxItems: 5, allowDuplicates: false },
    };
    expect(
      validateCart(cfg, [
        { shopifyProductGid: "a", quantity: 1 },
        { shopifyProductGid: "a", quantity: 1 },
      ]).errors,
    ).toContain("duplicates not allowed");
  });

  it("build_box: each step's pickCount enforced", () => {
    const cfg = {
      type: "build_box",
      config: {
        minItems: 4,
        maxItems: 4,
        steps: [
          { name: "Step 1", pickCount: 1 },
          { name: "Step 2", pickCount: 3 },
        ],
      },
    };
    const r = validateCart(cfg, [
      { shopifyProductGid: "a", quantity: 1, groupName: "Step 1" },
      { shopifyProductGid: "b", quantity: 1, groupName: "Step 2" },
      { shopifyProductGid: "c", quantity: 1, groupName: "Step 2" },
      { shopifyProductGid: "d", quantity: 1, groupName: "Step 2" }, // 4 total
      { shopifyProductGid: "e", quantity: 1, groupName: "Step 2" }, // step 2 = 4, expected 3
    ]);
    expect(r.valid).toBe(false);
    expect(r.errors.find((e) => /Step 2/.test(e))).toBeDefined();
  });

  it("multipack: exact packQuantity required", () => {
    const cfg = { type: "multipack", config: { packQuantity: 6 } };
    expect(validateCart(cfg, [{ shopifyProductGid: "a", quantity: 5 }]).valid).toBe(false);
    expect(validateCart(cfg, [{ shopifyProductGid: "a", quantity: 6 }]).valid).toBe(true);
  });

  it("fixed bundle just needs at least one item", () => {
    expect(
      validateCart(
        { type: "fixed", config: {} },
        [{ shopifyProductGid: "a", quantity: 1 }],
      ).valid,
    ).toBe(true);
  });
});
