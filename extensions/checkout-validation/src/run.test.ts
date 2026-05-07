import { describe, it, expect } from "vitest";

import { run } from "./index.js";

const line = (
  id: string,
  bundleId: string | null,
  qty: number,
  min: number | null = null,
  max: number | null = null,
) => ({
  id,
  quantity: qty,
  mintbundleBundleId: bundleId ? { value: bundleId } : null,
  mintbundleMin: min !== null ? { value: String(min) } : null,
  mintbundleMax: max !== null ? { value: String(max) } : null,
});

describe("Checkout Validation Function — run()", () => {
  it("returns no errors when no bundle lines present", () => {
    expect(run({ cart: { lines: [line("1", null, 1)] } }).errors).toEqual([]);
  });

  it("blocks when bundle qty is below min", () => {
    const out = run({
      cart: { lines: [line("1", "b-1", 1, 3, null)] },
    });
    expect(out.errors).toHaveLength(1);
    expect(out.errors[0].message).toMatch(/at least 3/);
  });

  it("blocks when bundle qty exceeds max", () => {
    const out = run({
      cart: {
        lines: [
          line("1", "b-1", 5, null, 4),
          line("2", "b-1", 2, null, 4),
        ],
      },
    });
    expect(out.errors).toHaveLength(1);
    expect(out.errors[0].message).toMatch(/at most 4/);
  });

  it("passes when bundle qty is within bounds", () => {
    const out = run({
      cart: { lines: [line("1", "b-1", 3, 2, 5)] },
    });
    expect(out.errors).toEqual([]);
  });
});
