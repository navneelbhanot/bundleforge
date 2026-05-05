import { describe, it, expect } from "vitest";

import { run } from "./run.js";

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
});
