import { describe, it, expect } from "vitest";

import { run } from "./index.js";

const baseLine = (id: string, amount: string, qty: number, attrs: Record<string, string> = {}) => ({
  id,
  quantity: qty,
  cost: { amountPerQuantity: { amount, currencyCode: "USD" } },
  bundleforgeBundleId: attrs.bundleId ? { value: attrs.bundleId } : null,
  bundleforgeRules: attrs.rules ? { value: attrs.rules } : null,
});

describe("Cart Transform Function — run()", () => {
  it("returns empty operations when no bundle lines", () => {
    const out = run({ cart: { lines: [baseLine("li-1", "10.00", 1)] } });
    expect(out.operations).toEqual([]);
  });

  it("emits an update operation for a single bundle line with a percentage rule", () => {
    const out = run({
      cart: {
        lines: [
          baseLine("gid://CartLine/1", "10.00", 2, {
            bundleId: "b-1",
            rules: JSON.stringify([
              { id: "r1", type: "percentage", value: "10", priority: 0, stackable: false },
            ]),
          }),
        ],
      },
    });
    expect(out.operations).toHaveLength(1);
    const op = out.operations[0];
    expect(op.update.cartLineId).toBe("gid://CartLine/1");
    // 10% off $20 = $2 -> per-unit reduction $1 -> new price $9.00
    expect(op.update.price.adjustment.fixedPricePerUnit.amount).toBe("9.00");
  });

  it("ignores bundle lines whose rules JSON is malformed", () => {
    const out = run({
      cart: {
        lines: [
          baseLine("li-1", "10.00", 2, { bundleId: "b-1", rules: "not-json" }),
        ],
      },
    });
    expect(out.operations).toEqual([]);
  });

  describe("expand path (metafield-driven)", () => {
    const bundleProductLine = (overrides: Record<string, unknown> = {}) => ({
      id: "gid://CartLine/parent",
      quantity: 1,
      cost: { amountPerQuantity: { amount: "30.00", currencyCode: "USD" } },
      bundleforgeBundleId: null,
      bundleforgeRules: null,
      merchandise: {
        id: "gid://shopify/ProductVariant/parent",
        product: {
          id: "gid://shopify/Product/parent",
          isBundleMetafield: { value: "true" },
          componentsMetafield: {
            value: JSON.stringify({
              schemaVersion: 1,
              bundleId: "b-1",
              components: [
                { variantGid: "gid://shopify/ProductVariant/A", quantity: 2, sku: "A" },
                { variantGid: "gid://shopify/ProductVariant/B", quantity: 1, sku: "B" },
              ],
              pricingRules: [],
            }),
          },
        },
      },
      ...overrides,
    });

    it("emits expand op when product has bundleforge.is_bundle + components", () => {
      const out = run({ cart: { lines: [bundleProductLine()] } });
      expect(out.operations).toHaveLength(1);
      const op = out.operations[0] as {
        expand: { cartLineId: string; expandedCartItems: Array<{ merchandiseId: string; quantity: number }> };
      };
      expect(op.expand.cartLineId).toBe("gid://CartLine/parent");
      expect(op.expand.expandedCartItems).toEqual([
        { merchandiseId: "gid://shopify/ProductVariant/A", quantity: 2 },
        { merchandiseId: "gid://shopify/ProductVariant/B", quantity: 1 },
      ]);
    });

    it("ignores expand when is_bundle flag missing", () => {
      const line = bundleProductLine();
      // @ts-expect-error — test fixture mutation
      line.merchandise.product.isBundleMetafield = null;
      const out = run({ cart: { lines: [line] } });
      expect(out.operations).toEqual([]);
    });

    it("ignores expand on unsupported schema version", () => {
      const line = bundleProductLine();
      // @ts-expect-error — test fixture mutation
      line.merchandise.product.componentsMetafield = {
        value: JSON.stringify({ schemaVersion: 99, components: [] }),
      };
      const out = run({ cart: { lines: [line] } });
      expect(out.operations).toEqual([]);
    });

    it("ignores expand when components metafield is malformed JSON", () => {
      const line = bundleProductLine();
      // @ts-expect-error — test fixture mutation
      line.merchandise.product.componentsMetafield = { value: "{not-json" };
      const out = run({ cart: { lines: [line] } });
      expect(out.operations).toEqual([]);
    });

    it("skips expand when shop opts into components_as_attributes mode", () => {
      const out = run({
        cart: { lines: [bundleProductLine()] },
        shop: {
          cartDefaultModeMetafield: { value: "components_as_attributes" },
        },
      });
      expect(out.operations).toEqual([]);
    });

    it("still expands when shop metafield is unset (default mode)", () => {
      const out = run({
        cart: { lines: [bundleProductLine()] },
        shop: {},
      });
      expect(out.operations).toHaveLength(1);
      expect(Object.keys(out.operations[0] as object)[0]).toBe("expand");
    });

    it("still expands when shop metafield value is unrecognized", () => {
      const out = run({
        cart: { lines: [bundleProductLine()] },
        shop: { cartDefaultModeMetafield: { value: "nope" } },
      });
      expect(out.operations).toHaveLength(1);
      expect(Object.keys(out.operations[0] as object)[0]).toBe("expand");
    });

    it("returns expand + update ops together when both paths fire", () => {
      const out = run({
        cart: {
          lines: [
            bundleProductLine(),
            baseLine("gid://CartLine/2", "10.00", 2, {
              bundleId: "b-2",
              rules: JSON.stringify([
                { id: "r1", type: "percentage", value: "10", priority: 0, stackable: false },
              ]),
            }),
          ],
        },
      });
      expect(out.operations).toHaveLength(2);
      const kinds = out.operations.map((o: Record<string, unknown>) =>
        Object.keys(o)[0],
      );
      expect(new Set(kinds)).toEqual(new Set(["expand", "update"]));
    });
  });
});
