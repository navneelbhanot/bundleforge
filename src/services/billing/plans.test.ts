import { describe, it, expect } from "vitest";

import {
  PLAN_CAPS,
  PLAN_FEATURES,
  PLANS,
  annualUsd,
  planFeatures,
  planFor,
} from "./plans";

describe("annualUsd", () => {
  it("computes a 20% discount on monthly × 12", () => {
    expect(annualUsd("growth")).toBe(Math.round(12 * 12 * 0.8));
    expect(annualUsd("pro")).toBe(Math.round(35 * 12 * 0.8));
    expect(annualUsd("enterprise")).toBe(Math.round(129 * 12 * 0.8));
  });

  it("is 0 for the free starter plan", () => {
    expect(annualUsd("starter")).toBe(0);
  });
});

describe("PLAN_CAPS", () => {
  it("contains all four plans", () => {
    for (const p of PLANS) {
      expect(PLAN_CAPS[p]).toBeDefined();
      expect(PLAN_CAPS[p].monthlyPriceUsd).toBeGreaterThanOrEqual(0);
    }
  });

  it("has trialDays >= 0", () => {
    for (const p of PLANS) {
      expect(PLAN_CAPS[p].trialDays).toBeGreaterThanOrEqual(0);
    }
  });

  it("has monotonic monthly prices across tiers", () => {
    expect(PLAN_CAPS.growth.monthlyPriceUsd).toBeGreaterThan(
      PLAN_CAPS.starter.monthlyPriceUsd,
    );
    expect(PLAN_CAPS.pro.monthlyPriceUsd).toBeGreaterThan(
      PLAN_CAPS.growth.monthlyPriceUsd,
    );
    expect(PLAN_CAPS.enterprise.monthlyPriceUsd).toBeGreaterThan(
      PLAN_CAPS.pro.monthlyPriceUsd,
    );
  });
});

describe("planFeatures", () => {
  it("falls back to starter for unknown values", () => {
    expect(planFeatures(undefined)).toEqual(PLAN_FEATURES.starter);
    expect(planFeatures("free")).toEqual(PLAN_FEATURES.starter);
  });

  it("higher tiers carry every feature flag of lower tiers (monotonic)", () => {
    const tiers: Array<keyof typeof PLAN_FEATURES> = [
      "starter",
      "growth",
      "pro",
      "enterprise",
    ];
    for (let i = 1; i < tiers.length; i++) {
      const lower = PLAN_FEATURES[tiers[i - 1]];
      const higher = PLAN_FEATURES[tiers[i]];
      for (const key of Object.keys(lower) as Array<keyof typeof lower>) {
        if (lower[key]) expect(higher[key]).toBe(true);
      }
    }
  });

  it("3PL sync is gated to pro+", () => {
    expect(PLAN_FEATURES.starter.threePlSync).toBe(false);
    expect(PLAN_FEATURES.growth.threePlSync).toBe(false);
    expect(PLAN_FEATURES.pro.threePlSync).toBe(true);
    expect(PLAN_FEATURES.enterprise.threePlSync).toBe(true);
  });

  it("headless is gated to enterprise only", () => {
    expect(PLAN_FEATURES.starter.headless).toBe(false);
    expect(PLAN_FEATURES.growth.headless).toBe(false);
    expect(PLAN_FEATURES.pro.headless).toBe(false);
    expect(PLAN_FEATURES.enterprise.headless).toBe(true);
  });
});

describe("planFor", () => {
  it("returns valid plan names unchanged", () => {
    for (const p of PLANS) {
      expect(planFor(p)).toBe(p);
    }
  });

  it("returns starter for null/undefined/unknown", () => {
    expect(planFor(null)).toBe("starter");
    expect(planFor(undefined)).toBe("starter");
    expect(planFor("custom")).toBe("starter");
  });
});
