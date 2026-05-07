/**
 * Monthly / Annual segmented toggle (M-204).
 *
 * Pure presentational. The parent (BillingPanel) holds the
 * interval state and swaps the value on click; this component
 * just renders two pressable buttons.
 *
 * Default selection in the parent is "annual" — that's the
 * discount-favouring side and matches the conversion goal.
 */
import { ButtonGroup, Button, BlockStack, Text } from "@shopify/polaris";

export type BillingInterval = "monthly" | "annual";

export interface IntervalToggleProps {
  value: BillingInterval;
  onChange: (next: BillingInterval) => void;
}

export function IntervalToggle({
  value,
  onChange,
}: IntervalToggleProps): JSX.Element {
  return (
    <BlockStack gap="100" inlineAlign="end">
      <ButtonGroup variant="segmented">
        <Button
          pressed={value === "monthly"}
          onClick={() => onChange("monthly")}
        >
          Monthly
        </Button>
        <Button
          pressed={value === "annual"}
          onClick={() => onChange("annual")}
        >
          Annual (–20%)
        </Button>
      </ButtonGroup>
      <Text as="p" tone="subdued" variant="bodySm">
        Annual billing saves 20% off the monthly rate.
      </Text>
    </BlockStack>
  );
}
