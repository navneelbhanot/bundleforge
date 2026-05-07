/**
 * PlanCard (M-204).
 *
 * One pricing card for the Billing comparison grid. Pure
 * presentational — data + actions are passed in. The visual
 * structure top-to-bottom:
 *
 *   1. Header row: plan name + "Most popular" / "Current plan"
 *      badge (mutually exclusive in practice; current wins).
 *   2. Tagline (one-liner about who the plan is for).
 *   3. Price block (large), with subtext for the alternate
 *      interval ("or save 20% with annual" / "or pay monthly").
 *   4. Caps summary ("5 bundles · 100 orders/mo" or
 *      "Unlimited bundles · Unlimited orders").
 *   5. Trial pill (when trialDays > 0).
 *   6. Feature list — checkmarks for every PlanFeatures key
 *      that's true on this plan, in FEATURE_ORDER. Unchecked
 *      flags are hidden; dont' grey them out — keeps the card
 *      scannable.
 *   7. Action button — "Subscribe" / "Upgrade" / "Downgrade" /
 *      "Current plan" depending on plan-relative position.
 */
import { useMemo } from "react";
import {
  Badge,
  BlockStack,
  Box,
  Button,
  Card,
  InlineStack,
  Text,
} from "@shopify/polaris";

import {
  FEATURE_ORDER,
  PLAN_TAGLINE,
  summariseCaps,
} from "./featureLabels";
import type { BillingInterval } from "./IntervalToggle";

export interface PlanCardCaps {
  maxBundles: number | null;
  maxOrdersPerMonth: number | null;
  monthlyPriceUsd: number;
  annualPriceUsd: number;
  trialDays: number;
}

export interface PlanCardData {
  name: string;
  caps: PlanCardCaps;
  features: Record<string, boolean>;
}

export interface PlanCardProps {
  plan: PlanCardData;
  /** Resolved name of the shop's current plan (lowercased). */
  currentPlan: string;
  /** Selected interval from the parent toggle. */
  interval: BillingInterval;
  /** Disable the action button (e.g. while a subscribe call is in-flight). */
  busy: boolean;
  /** Fired when the merchant clicks the action button. */
  onSubscribe: (planName: string, interval: BillingInterval) => void;
}

const PLAN_RANK: Record<string, number> = {
  starter: 0,
  growth: 1,
  pro: 2,
  enterprise: 3,
};

function actionFor(
  plan: string,
  current: string,
): {
  label: string;
  variant: "primary" | "secondary" | "tertiary";
  disabled: boolean;
  tooltip?: string;
} {
  if (plan === current) {
    return { label: "Current plan", variant: "tertiary", disabled: true };
  }
  const planRank = PLAN_RANK[plan] ?? 0;
  const currentRank = PLAN_RANK[current] ?? 0;
  if (planRank > currentRank) {
    // Upgrade path. The recommended pick (Growth) gets primary;
    // higher tiers get secondary so they don't shout louder than
    // the natural next step.
    return {
      label: "Upgrade",
      variant: plan === "growth" ? "primary" : "secondary",
      disabled: false,
    };
  }
  // Downgrade path. Starter is technically "Cancel + return to free"
  // — out of scope for first ship. Keep disabled with a tooltip.
  return {
    label: "Downgrade",
    variant: "tertiary",
    disabled: true,
    tooltip:
      "To downgrade, cancel your current subscription. We'll add a one-click downgrade in a follow-up.",
  };
}

function priceLine(plan: PlanCardData, interval: BillingInterval): {
  primary: string;
  alternate: string;
} {
  if (plan.name === "starter") {
    return { primary: "Free", alternate: "" };
  }
  if (interval === "annual") {
    const monthlyEquivalent = (plan.caps.annualPriceUsd / 12).toFixed(2);
    return {
      primary: `$${plan.caps.annualPriceUsd}/yr`,
      alternate: `$${monthlyEquivalent}/mo equivalent · or pay monthly $${plan.caps.monthlyPriceUsd}`,
    };
  }
  return {
    primary: `$${plan.caps.monthlyPriceUsd}/mo`,
    alternate: `or save 20% with annual ($${plan.caps.annualPriceUsd}/yr)`,
  };
}

export function PlanCard({
  plan,
  currentPlan,
  interval,
  busy,
  onSubscribe,
}: PlanCardProps): JSX.Element {
  const isCurrent = plan.name === currentPlan;
  const isMostPopular = plan.name === "growth" && !isCurrent;
  const action = actionFor(plan.name, currentPlan);
  const price = priceLine(plan, interval);
  const capSummary = useMemo(() => summariseCaps(plan.caps), [plan.caps]);
  const featureList = useMemo(
    () => FEATURE_ORDER.filter((f) => plan.features[f.key]),
    [plan.features],
  );
  const tagline = PLAN_TAGLINE[plan.name] ?? "";

  return (
    <Card>
      <BlockStack gap="400">
        <InlineStack align="space-between" blockAlign="center" wrap={false}>
          <Text as="h3" variant="headingMd" tone={isCurrent ? "success" : "base"}>
            {capitalise(plan.name)}
          </Text>
          {isCurrent ? (
            <Badge tone="success">Current plan</Badge>
          ) : isMostPopular ? (
            <Badge tone="attention">Most popular</Badge>
          ) : null}
        </InlineStack>

        {tagline ? (
          <Text as="p" tone="subdued" variant="bodySm">
            {tagline}
          </Text>
        ) : null}

        <BlockStack gap="100">
          <Text as="p" variant="heading2xl" fontWeight="bold">
            {price.primary}
          </Text>
          {price.alternate ? (
            <Text as="p" tone="subdued" variant="bodySm">
              {price.alternate}
            </Text>
          ) : null}
        </BlockStack>

        <BlockStack gap="100">
          <Text as="p" fontWeight="medium">
            {capSummary.bundles}
          </Text>
          <Text as="p" fontWeight="medium">
            {capSummary.orders}
          </Text>
          {capSummary.trial ? (
            <Box paddingBlockStart="100">
              <Badge tone="info">{capSummary.trial}</Badge>
            </Box>
          ) : null}
        </BlockStack>

        <Box paddingBlockStart="100" paddingBlockEnd="100">
          <hr style={{ border: "none", borderTop: "1px solid #e1e3e5" }} />
        </Box>

        {featureList.length === 0 ? (
          <Text as="p" tone="subdued" variant="bodySm">
            Core bundle features only.
          </Text>
        ) : (
          <BlockStack gap="200">
            {featureList.map((f) => (
              <InlineStack key={f.key} gap="200" blockAlign="start" wrap={false}>
                <Text as="span" tone="success" variant="bodyMd">
                  ✓
                </Text>
                <Text as="span" variant="bodyMd">
                  {f.label}
                </Text>
              </InlineStack>
            ))}
          </BlockStack>
        )}

        <Box paddingBlockStart="200">
          <Button
            variant={action.variant}
            disabled={action.disabled || busy}
            onClick={() => onSubscribe(plan.name, interval)}
            fullWidth
          >
            {action.label}
          </Button>
          {action.tooltip ? (
            <Box paddingBlockStart="100">
              <Text as="p" tone="subdued" variant="bodySm">
                {action.tooltip}
              </Text>
            </Box>
          ) : null}
        </Box>
      </BlockStack>
    </Card>
  );
}

function capitalise(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
