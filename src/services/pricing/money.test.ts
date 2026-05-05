import { describe, it, expect } from "vitest";

import { fromCents, sumLineItemsCents, toCents } from "./money";
import type { PricingLineItem } from "./contract";

describe("toCents", () => {
  it("handles whole amounts", () => {
    expect(toCents("0")).toBe(0);
    expect(toCents("1")).toBe(100);
    expect(toCents("123")).toBe(12300);
  });

  it("handles two-decimal amounts", () => {
    expect(toCents("0.00")).toBe(0);
    expect(toCents("12.50")).toBe(1250);
    expect(toCents("99.99")).toBe(9999);
  });

  it("pads single decimal", () => {
    expect(toCents("12.5")).toBe(1250);
  });

  it("rounds half-to-even (banker's)", () => {
    // 12.345 -> 12.34 (4 is even)
    expect(toCents("12.345")).toBe(1234);
    // 12.355 -> 12.36 (5 is odd, round up)
    expect(toCents("12.355")).toBe(1236);
    // 12.346 -> 12.35 (just over half)
    expect(toCents("12.346")).toBe(1235);
  });

  it("handles negatives", () => {
    expect(toCents("-12.50")).toBe(-1250);
  });

  it("throws on garbage", () => {
    expect(() => toCents("abc")).toThrow();
    expect(() => toCents("")).toThrow();
  });
});

describe("fromCents", () => {
  it("roundtrips integer cents", () => {
    for (const c of [0, 1, 99, 100, 1234, 1_000_000]) {
      const m = fromCents(c, "USD");
      expect(toCents(m.amount)).toBe(c);
    }
  });

  it("preserves negatives", () => {
    expect(fromCents(-1250, "USD")).toEqual({
      amount: "-12.50",
      currencyCode: "USD",
    });
  });
});

describe("sumLineItemsCents", () => {
  const item = (id: string, amount: string, qty: number): PricingLineItem => ({
    id,
    unitPrice: { amount, currencyCode: "USD" },
    quantity: qty,
  });

  it("returns zero for empty", () => {
    expect(sumLineItemsCents([])).toEqual({
      cents: 0,
      currencyCode: "USD",
      totalQuantity: 0,
    });
  });

  it("sums prices × quantities", () => {
    const result = sumLineItemsCents([
      item("a", "10.00", 2),
      item("b", "5.50", 1),
    ]);
    expect(result.cents).toBe(2 * 1000 + 550);
    expect(result.totalQuantity).toBe(3);
  });

  it("throws on mixed currencies", () => {
    expect(() =>
      sumLineItemsCents([
        item("a", "10.00", 1),
        { id: "b", unitPrice: { amount: "5.00", currencyCode: "EUR" }, quantity: 1 },
      ]),
    ).toThrow(/Mixed currencies/);
  });
});
