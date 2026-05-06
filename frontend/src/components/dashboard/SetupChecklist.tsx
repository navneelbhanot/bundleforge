/**
 * Dashboard onboarding checklist (M-186).
 *
 * Three steps that map to BundleForge's actual ship-readiness
 * journey: create → publish → add the storefront block. Steps 1
 * and 2 are auto-detected from bundle counts; step 3 is manual
 * mark-complete.
 *
 * Visibility: SetupChecklist returns null when dismissed or when
 * every step is complete, so DashboardPage doesn't need its own
 * branching — just render it.
 */
import { CheckCircleIcon, XIcon } from "@shopify/polaris-icons";
import {
  BlockStack,
  Box,
  Button,
  Card,
  Icon,
  InlineStack,
  ProgressBar,
  Text,
} from "@shopify/polaris";

export interface ChecklistStep {
  id: "create" | "publish" | "block";
  title: string;
  body: string;
  done: boolean;
  /** Primary CTA when not done. */
  primary?: { label: string; url?: string; external?: boolean; onClick?: () => void };
  /** Secondary CTA when not done (e.g. "Mark complete"). */
  secondary?: { label: string; onClick?: () => void };
}

export interface SetupChecklistProps {
  steps: readonly ChecklistStep[];
  dismissed: boolean;
  onDismiss: () => void;
  busy?: boolean;
}

function StepRow({ step }: { step: ChecklistStep }): JSX.Element {
  return (
    <Box
      padding="300"
      background={step.done ? "bg-surface-success" : "bg-surface"}
      borderColor="border"
      borderWidth="025"
      borderRadius="200"
    >
      <InlineStack align="space-between" blockAlign="start" gap="400" wrap={false}>
        <InlineStack gap="300" blockAlign="start" wrap={false}>
          <Box paddingBlockStart="050">
            {step.done ? (
              <span
                style={{
                  display: "inline-flex",
                  width: 22,
                  height: 22,
                  alignItems: "center",
                  justifyContent: "center",
                  color: "var(--p-color-icon-success)",
                }}
              >
                <Icon source={CheckCircleIcon} tone="success" />
              </span>
            ) : (
              <span
                aria-hidden
                style={{
                  display: "inline-block",
                  width: 18,
                  height: 18,
                  border: "1.5px dashed var(--p-color-border-emphasis)",
                  borderRadius: "50%",
                  marginTop: 2,
                }}
              />
            )}
          </Box>
          <BlockStack gap="100">
            <Text
              as="h3"
              variant="bodyMd"
              fontWeight="semibold"
              tone={step.done ? "subdued" : undefined}
            >
              {step.title}
            </Text>
            <Text as="p" tone="subdued" variant="bodySm">
              {step.body}
            </Text>
          </BlockStack>
        </InlineStack>
        {!step.done && (step.primary || step.secondary) ? (
          <InlineStack gap="200" wrap={false}>
            {step.secondary ? (
              <Button onClick={step.secondary.onClick} variant="tertiary">
                {step.secondary.label}
              </Button>
            ) : null}
            {step.primary ? (
              <Button
                variant="primary"
                url={step.primary.url}
                external={step.primary.external}
                onClick={step.primary.onClick}
              >
                {step.primary.label}
              </Button>
            ) : null}
          </InlineStack>
        ) : null}
      </InlineStack>
    </Box>
  );
}

export function SetupChecklist({
  steps,
  dismissed,
  onDismiss,
  busy,
}: SetupChecklistProps): JSX.Element | null {
  const total = steps.length;
  const complete = steps.filter((s) => s.done).length;
  // Auto-retire when everything is done — no extra dismiss click needed.
  if (dismissed || complete === total) return null;

  return (
    <Card>
      <BlockStack gap="400">
        <InlineStack align="space-between" blockAlign="center">
          <BlockStack gap="100">
            <Text as="h2" variant="headingMd">
              Get set up with BundleForge
            </Text>
            <Text as="p" tone="subdued" variant="bodySm">
              {complete} of {total} complete
            </Text>
          </BlockStack>
          <Button
            icon={XIcon}
            variant="tertiary"
            accessibilityLabel="Dismiss checklist"
            onClick={onDismiss}
            disabled={busy}
          />
        </InlineStack>
        <ProgressBar progress={(complete / total) * 100} size="small" />
        <BlockStack gap="200">
          {steps.map((step) => (
            <StepRow key={step.id} step={step} />
          ))}
        </BlockStack>
      </BlockStack>
    </Card>
  );
}
