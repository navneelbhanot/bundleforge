import { describe, it, expect } from "vitest";

import type { PricingInput, PricingRule } from "./contract";
import { computeBundlePrice } from "./engine";
import { FIXTURES_DIR, loadFixtures } from "../../../tests/pricing/loadFixtures";

const usd = (amount: string) => ({ amount, currencyCode: "USD" });

const baseInput = (overrides: Partial<PricingInput> = {}): PricingInput => ({
  bundleId: "b-1",
  currencyCode: "USD",
  lineItems: [{ id: "li-1", unitPrice: usd("10.00"), quantity: 2 }],
  rules: [],
  context: { now: "2026-05-04T00:00:00Z" },
  ...overrides,
});

const fixedRule = (overrides: Partial<PricingRule> = {}): PricingRule => ({
  id: "r-1",
  type: "fixed",
  value: "5.00",
  priority: 0,
  stackable: false,
  ...overrides,
});

describe("computeBundlePrice — basics", () => {
  it("no rules → discount 0, total = subtotal", () => {
    const r = computeBundlePrice(baseInput());
    expect(r.subtotal.amount).toBe("20.00");
    expect(r.totalDiscount.amount).toBe("0.00");
    expect(r.total.amount).toBe("20.00");
    expect(r.applied).toEqual([]);
  });

  it("single fixed rule applies", () => {
    const r = computeBundlePrice(baseInput({ rules: [fixedRule()] }));
    expect(r.totalDiscount.amount).toBe("5.00");
    expect(r.total.amount).toBe("15.00");
    expect(r.applied).toHaveLength(1);
  });
});

describe("computeBundlePrice — gates", () => {
  it("minQuantity not met → skipped", () => {
    const r = computeBundlePrice(
      baseInput({ rules: [fixedRule({ minQuantity: 10 })] }),
    );
    expect(r.applied).toEqual([]);
    expect(r.skipped[0].reason).toBe("min_quantity_not_met");
  });

  it("maxQuantity exceeded → skipped", () => {
    const r = computeBundlePrice(
      baseInput({ rules: [fixedRule({ maxQuantity: 1 })] }),
    );
    expect(r.applied).toEqual([]);
    expect(r.skipped[0].reason).toBe("max_quantity_exceeded");
  });

  it("minCartValue not met → skipped", () => {
    const r = computeBundlePrice(
      baseInput({ rules: [fixedRule({ minCartValue: "100.00" })] }),
    );
    expect(r.applied).toEqual([]);
    expect(r.skipped[0].reason).toBe("min_cart_value_not_met");
  });

  it("date window: before startsAt → skipped", () => {
    const r = computeBundlePrice(
      baseInput({
        rules: [
          fixedRule({
            conditions: { startsAt: "2027-01-01T00:00:00Z" },
          }),
        ],
      }),
    );
    expect(r.applied).toEqual([]);
    expect(r.skipped[0].reason).toBe("outside_date_window");
  });

  it("customer tag mismatch → skipped", () => {
    const r = computeBundlePrice(
      baseInput({
        context: { now: "2026-05-04T00:00:00Z", customerTags: ["bronze"] },
        rules: [
          fixedRule({ conditions: { customerTags: ["vip"] } }),
        ],
      }),
    );
    expect(r.applied).toEqual([]);
    expect(r.skipped[0].reason).toBe("condition_not_met");
  });

  it("country mismatch → skipped", () => {
    const r = computeBundlePrice(
      baseInput({
        context: { now: "2026-05-04T00:00:00Z", country: "DE" },
        rules: [
          fixedRule({ conditions: { countries: ["US", "CA"] } }),
        ],
      }),
    );
    expect(r.applied).toEqual([]);
  });
});

describe("computeBundlePrice — stackability", () => {
  it("two stackable rules accumulate", () => {
    const r = computeBundlePrice(
      baseInput({
        rules: [
          fixedRule({ id: "a", value: "3.00", stackable: true }),
          fixedRule({ id: "b", value: "2.00", stackable: true }),
        ],
      }),
    );
    expect(r.totalDiscount.amount).toBe("5.00");
    expect(r.applied.map((a) => a.ruleId).sort()).toEqual(["a", "b"]);
  });

  it("two non-stackable rules: highest priority wins", () => {
    const r = computeBundlePrice(
      baseInput({
        rules: [
          fixedRule({ id: "lo", value: "2.00", priority: 1, stackable: false }),
          fixedRule({ id: "hi", value: "8.00", priority: 5, stackable: false }),
        ],
      }),
    );
    expect(r.applied).toHaveLength(1);
    expect(r.applied[0].ruleId).toBe("hi");
    const skip = r.skipped.find((s) => s.ruleId === "lo");
    expect(skip?.reason).toBe("non_stackable_lower_priority");
  });
});

describe("computeBundlePrice — percentage rule (M-041)", () => {
  it("10% off applies", () => {
    const r = computeBundlePrice(
      baseInput({
        rules: [
          { id: "r1", type: "percentage", value: "10", priority: 0, stackable: false },
        ],
      }),
    );
    expect(r.totalDiscount.amount).toBe("2.00");
    expect(r.total.amount).toBe("18.00");
  });

  it("100% off equals subtotal", () => {
    const r = computeBundlePrice(
      baseInput({
        rules: [
          { id: "r1", type: "percentage", value: "100", priority: 0, stackable: false },
        ],
      }),
    );
    expect(r.totalDiscount.amount).toBe("20.00");
    expect(r.total.amount).toBe("0.00");
  });

  it(">100% is clamped to 100%", () => {
    const r = computeBundlePrice(
      baseInput({
        rules: [
          { id: "r1", type: "percentage", value: "200", priority: 0, stackable: false },
        ],
      }),
    );
    expect(r.totalDiscount.amount).toBe("20.00");
  });

  it("0% applies no discount and is not in applied[] (zero discount filter)", () => {
    const r = computeBundlePrice(
      baseInput({
        rules: [
          { id: "r1", type: "percentage", value: "0", priority: 0, stackable: false },
        ],
      }),
    );
    expect(r.applied).toEqual([]);
    expect(r.totalDiscount.amount).toBe("0.00");
  });
});

describe("computeBundlePrice — flat_discount (M-042)", () => {
  it("applies $1 off each unit", () => {
    const r = computeBundlePrice(
      baseInput({
        rules: [
          { id: "fd", type: "flat_discount", value: "1.00", priority: 0, stackable: false },
        ],
      }),
    );
    expect(r.totalDiscount.amount).toBe("2.00"); // 2 units × $1
  });

  it("clamps at subtotal when per-unit × qty exceeds", () => {
    const r = computeBundlePrice(
      baseInput({
        rules: [
          { id: "fd", type: "flat_discount", value: "1000.00", priority: 0, stackable: false },
        ],
      }),
    );
    expect(r.totalDiscount.amount).toBe("20.00");
  });
});

describe("computeBundlePrice — tiered (M-043)", () => {
  it("non-stackable tiers: highest priority qualifying tier wins", () => {
    const r = computeBundlePrice(
      baseInput({
        lineItems: [{ id: "li-1", unitPrice: usd("10.00"), quantity: 6 }],
        rules: [
          { id: "t1", type: "tiered", value: "5",  minQuantity: 3,  priority: 1, stackable: false },
          { id: "t2", type: "tiered", value: "10", minQuantity: 5,  priority: 2, stackable: false },
          { id: "t3", type: "tiered", value: "20", minQuantity: 10, priority: 3, stackable: false },
        ],
      }),
    );
    expect(r.applied).toHaveLength(1);
    expect(r.applied[0].ruleId).toBe("t2");
  });
});

describe("computeBundlePrice — volume (M-044)", () => {
  it("applies per-unit discount only at/beyond threshold", () => {
    const r = computeBundlePrice(
      baseInput({
        lineItems: [{ id: "li-1", unitPrice: usd("10.00"), quantity: 7 }],
        rules: [
          {
            id: "v1",
            type: "volume",
            value: "1.00",
            minQuantity: 5,
            priority: 0,
            stackable: false,
          },
        ],
      }),
    );
    // 7 - 5 + 1 = 3 qualifying units × $1 = $3
    expect(r.totalDiscount.amount).toBe("3.00");
  });

  it("zero discount when below threshold", () => {
    const r = computeBundlePrice(
      baseInput({
        lineItems: [{ id: "li-1", unitPrice: usd("10.00"), quantity: 2 }],
        rules: [
          {
            id: "v1",
            type: "volume",
            value: "1.00",
            minQuantity: 5,
            priority: 0,
            stackable: false,
          },
        ],
      }),
    );
    expect(r.applied).toEqual([]);
    expect(r.skipped[0].reason).toBe("min_quantity_not_met");
  });
});

describe("computeBundlePrice — bogo (M-045)", () => {
  it("buy 2 get 1 free with mixed prices uses cheapest as free", () => {
    const r = computeBundlePrice(
      baseInput({
        lineItems: [
          { id: "li-1", unitPrice: usd("5.00"),  quantity: 3 },
          { id: "li-2", unitPrice: usd("10.00"), quantity: 3 },
        ],
        rules: [
          {
            id: "b1",
            type: "bogo",
            value: "1",
            minQuantity: 2,
            priority: 0,
            stackable: false,
          },
        ],
      }),
    );
    // 6 units / set size 3 = 2 sets → 2 free units at $5 each = $10
    expect(r.totalDiscount.amount).toBe("10.00");
  });

  it("no discount when fewer items than one set", () => {
    const r = computeBundlePrice(
      baseInput({
        lineItems: [{ id: "li-1", unitPrice: usd("10.00"), quantity: 2 }],
        rules: [
          {
            id: "b1",
            type: "bogo",
            value: "1",
            minQuantity: 2,
            priority: 0,
            stackable: false,
          },
        ],
      }),
    );
    expect(r.applied).toEqual([]);
  });
});

describe("computeBundlePrice — stackability + priority (M-046)", () => {
  it("mixes stackable + non-stackable correctly", () => {
    const r = computeBundlePrice(
      baseInput({
        rules: [
          { id: "s1", type: "fixed", value: "1.00", priority: 0, stackable: true },
          { id: "ns-hi", type: "fixed", value: "5.00", priority: 5, stackable: false },
          { id: "ns-lo", type: "fixed", value: "3.00", priority: 1, stackable: false },
        ],
      }),
    );
    // s1 stacks; ns-hi wins among non-stackable
    expect(r.applied.map((a) => a.ruleId).sort()).toEqual(["ns-hi", "s1"]);
    expect(r.skipped.find((s) => s.ruleId === "ns-lo")?.reason).toBe(
      "non_stackable_lower_priority",
    );
  });
});

describe("computeBundlePrice — condition evaluator (M-047)", () => {
  it("date window: within range applies", () => {
    const r = computeBundlePrice(
      baseInput({
        context: { now: "2026-05-04T12:00:00Z" },
        rules: [
          {
            id: "r1",
            type: "fixed",
            value: "5.00",
            priority: 0,
            stackable: false,
            conditions: {
              startsAt: "2026-05-04T00:00:00Z",
              endsAt: "2026-05-05T00:00:00Z",
            },
          },
        ],
      }),
    );
    expect(r.applied).toHaveLength(1);
  });

  it("date window: after endsAt skipped", () => {
    const r = computeBundlePrice(
      baseInput({
        context: { now: "2027-01-01T00:00:00Z" },
        rules: [
          {
            id: "r1",
            type: "fixed",
            value: "5.00",
            priority: 0,
            stackable: false,
            conditions: { endsAt: "2026-05-05T00:00:00Z" },
          },
        ],
      }),
    );
    expect(r.applied).toEqual([]);
    expect(r.skipped[0].reason).toBe("outside_date_window");
  });

  it("customer tag matched (case-insensitive)", () => {
    const r = computeBundlePrice(
      baseInput({
        context: { now: "2026-05-04T00:00:00Z", customerTags: ["VIP"] },
        rules: [
          {
            id: "r1",
            type: "fixed",
            value: "5.00",
            priority: 0,
            stackable: false,
            conditions: { customerTags: ["vip"] },
          },
        ],
      }),
    );
    expect(r.applied).toHaveLength(1);
  });

  it("country matched (uppercased)", () => {
    const r = computeBundlePrice(
      baseInput({
        context: { now: "2026-05-04T00:00:00Z", country: "us" },
        rules: [
          {
            id: "r1",
            type: "fixed",
            value: "5.00",
            priority: 0,
            stackable: false,
            conditions: { countries: ["US"] },
          },
        ],
      }),
    );
    expect(r.applied).toHaveLength(1);
  });

  it("missing customer tag with required → skipped", () => {
    const r = computeBundlePrice(
      baseInput({
        rules: [
          {
            id: "r1",
            type: "fixed",
            value: "5.00",
            priority: 0,
            stackable: false,
            conditions: { customerTags: ["vip"] },
          },
        ],
      }),
    );
    expect(r.applied).toEqual([]);
  });
});

describe("computeBundlePrice — properties", () => {
  it("total is never negative even when discount > subtotal", () => {
    const r = computeBundlePrice(
      baseInput({
        rules: [fixedRule({ value: "1000.00", stackable: true })],
      }),
    );
    expect(r.total.amount).toBe("0.00");
    expect(r.totalDiscount.amount).toBe("20.00");
  });

  it("deterministic for identical inputs", () => {
    const inp = baseInput({
      rules: [fixedRule({ value: "3.00", stackable: true })],
    });
    const a = computeBundlePrice(inp);
    const b = computeBundlePrice(inp);
    expect(a).toEqual(b);
  });
});

describe("fixture-driven engine tests (ADR-0002 shared with Function)", () => {
  const fixtures = loadFixtures(FIXTURES_DIR);
  if (fixtures.length === 0) {
    it.skip("no fixtures present yet", () => {});
  } else {
    for (const f of fixtures) {
      it(`fixture: ${f.name}`, () => {
        const result = computeBundlePrice(f.input);
        expect(result).toEqual(f.expected);
      });
    }
  }
});
