/**
 * Plan registry — stub for M-008. Filled out in M-031.
 *
 * Source of truth for: plan names, monthly prices, bundle/order caps,
 * and rate-limit budgets.
 */
export type PlanName = "starter" | "growth" | "pro" | "enterprise";

export const PLANS: PlanName[] = ["starter", "growth", "pro", "enterprise"];

export interface PlanCaps {
  /** Maximum bundles a merchant on this plan can create. null = unlimited. */
  maxBundles: number | null;
  /** Soft cap on bundle orders processed per month. null = unlimited. */
  maxOrdersPerMonth: number | null;
  /** Public monthly price in USD. */
  monthlyPriceUsd: number;
}

export const PLAN_CAPS: Record<PlanName, PlanCaps> = {
  starter: { maxBundles: 5, maxOrdersPerMonth: 100, monthlyPriceUsd: 0 },
  growth: { maxBundles: null, maxOrdersPerMonth: null, monthlyPriceUsd: 12 },
  pro: { maxBundles: null, maxOrdersPerMonth: null, monthlyPriceUsd: 35 },
  enterprise: {
    maxBundles: null,
    maxOrdersPerMonth: null,
    monthlyPriceUsd: 129,
  },
};

export interface RateBudget {
  points: number;
  durationSec: number;
}

export const PLAN_RATE_LIMITS: Record<PlanName, RateBudget> = {
  starter: { points: 100, durationSec: 60 },
  growth: { points: 200, durationSec: 60 },
  pro: { points: 500, durationSec: 60 },
  enterprise: { points: 2000, durationSec: 60 },
};

export function planFor(name: string | undefined | null): PlanName {
  if (name && (PLANS as string[]).includes(name)) {
    return name as PlanName;
  }
  return "starter";
}
