/**
 * M-139 — Pricing engine property tests (extended).
 *
 * Random PricingInput generator + invariants:
 *
 *   1. total + totalDiscount === subtotal (±1 cent rounding).
 *   2. total >= 0.
 *   3. Adding a non-applying rule never changes the result.
 *   4. Removing a stackable rule never *increases* the discount.
 */
import { describe, it, expect } from "vitest";

import { computeBundlePrice } from "../../src/services/pricing/engine";
import type {
  PricingInput,
  PricingRule,
  PricingRuleType,
} from "../../src/services/pricing/contract";

function rng(seed: number): () => number {
  // Deterministic mulberry32; tests are reproducible by seed.
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function dec(rand: () => number, max: number): string {
  const cents = Math.floor(rand() * max * 100);
  const whole = Math.floor(cents / 100);
  const frac = (cents % 100).toString().padStart(2, "0");
  return `${whole}.${frac}`;
}

const RULE_TYPES: PricingRuleType[] = [
  "fixed",
  "percentage",
  "flat_discount",
  "tiered",
  "volume",
  "bogo",
];

function randomInput(rand: () => number): PricingInput {
  const itemCount = 1 + Math.floor(rand() * 4);
  const lineItems = Array.from({ length: itemCount }, (_, i) => ({
    id: `li-${i}`,
    unitPrice: { amount: dec(rand, 50), currencyCode: "USD" },
    quantity: 1 + Math.floor(rand() * 6),
  }));
  const ruleCount = Math.floor(rand() * 4);
  const rules: PricingRule[] = Array.from({ length: ruleCount }, (_, i) => {
    const type = RULE_TYPES[Math.floor(rand() * RULE_TYPES.length)];
    const valueMax = type === "percentage" || type === "tiered" ? 50 : 5;
    const value =
      type === "bogo" ? String(1 + Math.floor(rand() * 2)) : dec(rand, valueMax);
    return {
      id: `r-${i}`,
      type,
      value,
      minQuantity: rand() < 0.5 ? 1 + Math.floor(rand() * 3) : undefined,
      priority: i,
      stackable: rand() < 0.5,
    };
  });
  return {
    bundleId: "b",
    currencyCode: "USD",
    lineItems,
    rules,
    context: { now: "2026-05-05T00:00:00Z" },
  };
}

function toCents(amount: string): number {
  return Math.round(Number.parseFloat(amount) * 100);
}

describe("pricing invariants (M-139)", () => {
  it("total + totalDiscount === subtotal across 200 random inputs", () => {
    const r = rng(0xfeed);
    for (let i = 0; i < 200; i++) {
      const input = randomInput(r);
      const out = computeBundlePrice(input);
      const sub = toCents(out.subtotal.amount);
      const disc = toCents(out.totalDiscount.amount);
      const tot = toCents(out.total.amount);
      expect(tot + disc).toBe(sub);
      expect(tot).toBeGreaterThanOrEqual(0);
    }
  });

  it("adding a rule whose gates fail never changes the result", () => {
    const r = rng(0xc0de);
    for (let i = 0; i < 50; i++) {
      const input = randomInput(r);
      const before = computeBundlePrice(input);
      const failing: PricingRule = {
        id: "r-fail",
        type: "fixed",
        value: "5.00",
        minQuantity: 1_000_000,
        priority: 999,
        stackable: false,
      };
      const after = computeBundlePrice({
        ...input,
        rules: [...input.rules, failing],
      });
      // The result without `applied` should be identical; the new rule
      // shows up only in `skipped`.
      expect(after.total).toEqual(before.total);
      expect(after.totalDiscount).toEqual(before.totalDiscount);
      expect(after.applied).toEqual(before.applied);
    }
  });

  it("removing a stackable rule never increases the discount", () => {
    const r = rng(0xbeef);
    for (let i = 0; i < 50; i++) {
      const input = randomInput(r);
      const stackableIdx = input.rules.findIndex((rule) => rule.stackable);
      if (stackableIdx === -1) continue;
      const without = computeBundlePrice({
        ...input,
        rules: input.rules.filter((_, idx) => idx !== stackableIdx),
      });
      const withRule = computeBundlePrice(input);
      expect(toCents(without.totalDiscount.amount)).toBeLessThanOrEqual(
        toCents(withRule.totalDiscount.amount),
      );
    }
  });
});
