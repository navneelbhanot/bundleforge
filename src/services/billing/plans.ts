/**
 * Plan registry — single source of truth for plan names, prices, caps,
 * trial config, rate-limit budgets, and feature flags.
 *
 * Pricing per PRODUCT_PLAN.md §7. Annual = monthly × 12 × 0.8 (20% off),
 * rounded to nearest integer USD.
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
  /** Public annual price in USD (20% discount, rounded). */
  annualPriceUsd: number;
  /** Default trial days when first activating a paid plan. */
  trialDays: number;
}

function annual(monthly: number): number {
  return Math.round(monthly * 12 * 0.8);
}

export const PLAN_CAPS: Record<PlanName, PlanCaps> = {
  starter: {
    maxBundles: 5,
    maxOrdersPerMonth: 100,
    monthlyPriceUsd: 0,
    annualPriceUsd: 0,
    trialDays: 0,
  },
  growth: {
    maxBundles: null,
    maxOrdersPerMonth: null,
    monthlyPriceUsd: 12,
    annualPriceUsd: annual(12),
    trialDays: 14,
  },
  pro: {
    maxBundles: null,
    maxOrdersPerMonth: null,
    monthlyPriceUsd: 35,
    annualPriceUsd: annual(35),
    trialDays: 14,
  },
  enterprise: {
    maxBundles: null,
    maxOrdersPerMonth: null,
    monthlyPriceUsd: 129,
    annualPriceUsd: annual(129),
    trialDays: 14,
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

export interface PlanFeatures {
  visualBuilder: boolean;
  auditTrail: boolean;
  liveChat: boolean;
  basicAnalytics: boolean;
  posSingleLocation: boolean;
  threePlSync: boolean;
  abTesting: boolean;
  shopifyFlow: boolean;
  customMetafields: boolean;
  aiSuggestions: boolean;
  headless: boolean;
  whiteLabel: boolean;
}

const STARTER_FEATURES: PlanFeatures = {
  visualBuilder: true,
  auditTrail: false,
  liveChat: false,
  basicAnalytics: false,
  posSingleLocation: false,
  threePlSync: false,
  abTesting: false,
  shopifyFlow: false,
  customMetafields: false,
  aiSuggestions: false,
  headless: false,
  whiteLabel: false,
};

const GROWTH_FEATURES: PlanFeatures = {
  ...STARTER_FEATURES,
  auditTrail: true,
  liveChat: true,
  basicAnalytics: true,
  posSingleLocation: true,
  aiSuggestions: true,
};

const PRO_FEATURES: PlanFeatures = {
  ...GROWTH_FEATURES,
  threePlSync: true,
  abTesting: true,
  shopifyFlow: true,
  customMetafields: true,
};

const ENTERPRISE_FEATURES: PlanFeatures = {
  ...PRO_FEATURES,
  headless: true,
  whiteLabel: true,
};

export const PLAN_FEATURES: Record<PlanName, PlanFeatures> = {
  starter: STARTER_FEATURES,
  growth: GROWTH_FEATURES,
  pro: PRO_FEATURES,
  enterprise: ENTERPRISE_FEATURES,
};

export function planFor(name: string | undefined | null): PlanName {
  if (name && (PLANS as string[]).includes(name)) {
    return name as PlanName;
  }
  return "starter";
}

export function planFeatures(name: string | undefined | null): PlanFeatures {
  return PLAN_FEATURES[planFor(name)];
}

export function annualUsd(name: PlanName): number {
  return PLAN_CAPS[name].annualPriceUsd;
}
