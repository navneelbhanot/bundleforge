/**
 * Friendly labels for the PlanFeatures flags from
 * src/services/billing/plans.ts (M-204). Order matters — every
 * plan card renders the features in this exact order so the
 * cards line up visually as you scan left → right.
 *
 * Keep the order roughly:
 *  1. Foundational (always-true on Starter+).
 *  2. Support / quality-of-life (Growth+).
 *  3. Advanced workflow (Pro+).
 *  4. Enterprise.
 */

export interface FeatureLabel {
  /** Key in PlanFeatures (e.g. "auditTrail"). */
  key: string;
  /** Short user-facing label that fits on one line. */
  label: string;
}

export const FEATURE_ORDER: FeatureLabel[] = [
  { key: "visualBuilder", label: "Visual bundle builder" },
  { key: "auditTrail", label: "Inventory audit trail" },
  { key: "basicAnalytics", label: "Basic analytics" },
  { key: "liveChat", label: "Live chat support" },
  { key: "posSingleLocation", label: "POS — single location" },
  { key: "aiSuggestions", label: "AI bundle suggestions" },
  { key: "threePlSync", label: "3PL inventory sync" },
  { key: "abTesting", label: "A/B testing" },
  { key: "shopifyFlow", label: "Shopify Flow integration" },
  { key: "customMetafields", label: "Custom metafields" },
  { key: "headless", label: "Headless / Storefront API" },
  { key: "whiteLabel", label: "White-label branding" },
];

/**
 * One-line tagline rendered under the plan name (above the price)
 * on each card. Communicates "who this plan is for" in a glance.
 */
export const PLAN_TAGLINE: Record<string, string> = {
  starter: "Get started with bundle commerce",
  growth: "For shops scaling past their first 100 bundle orders",
  pro: "For multi-warehouse shops needing 3PL + experiments",
  enterprise: "For headless / white-label / multi-store operators",
};

/**
 * Friendly cap summary that goes between the price and the
 * feature list on each card.
 */
export interface CapSummary {
  bundles: string;
  orders: string;
  trial: string;
}

export function summariseCaps(input: {
  maxBundles: number | null;
  maxOrdersPerMonth: number | null;
  trialDays: number;
}): CapSummary {
  return {
    bundles:
      input.maxBundles === null
        ? "Unlimited bundles"
        : `${input.maxBundles} bundles`,
    orders:
      input.maxOrdersPerMonth === null
        ? "Unlimited orders / mo"
        : `${input.maxOrdersPerMonth} orders / mo`,
    trial: input.trialDays > 0 ? `${input.trialDays}-day free trial` : "",
  };
}
