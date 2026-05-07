/**
 * Onboarding wizard (M-108).
 *
 * Three-step flow shown to fresh shops:
 *   1. Welcome
 *   2. Create your first bundle
 *   3. Install the theme block
 *
 * Pure local state; no API calls. Shown at "/" when the merchant has
 * zero bundles. Dismissable.
 */
import { useState } from "react";
import { Card, Button, Text, ButtonGroup } from "@shopify/polaris";

const STEPS = [
  {
    title: "Welcome to MintBundle",
    body: "Start creating bundles in three quick steps.",
    cta: "Get started",
  },
  {
    title: "Create your first bundle",
    body:
      "Pick a bundle type — fixed, mix-and-match, build-a-box, BOGO, " +
      "subscription, and more — then add items.",
    cta: "Create bundle",
  },
  {
    title: "Install the theme block",
    body:
      "Open the theme editor, add the “MintBundle Bundle” block to a " +
      "product page, and pick the bundle slug.",
    cta: "Done",
  },
] as const;

export interface OnboardingWizardProps {
  onComplete?: () => void;
  onDismiss?: () => void;
}

export function OnboardingWizard({
  onComplete,
  onDismiss,
}: OnboardingWizardProps): JSX.Element {
  const [step, setStep] = useState(0);
  const cur = STEPS[step];
  const isLast = step === STEPS.length - 1;

  function next(): void {
    if (isLast) onComplete?.();
    else setStep(step + 1);
  }

  return (
    <Card>
      <Text as="h2" variant="headingMd">
        {cur.title}
      </Text>
      <Text as="p">{cur.body}</Text>
      <Text as="p" tone="subdued">
        Step {step + 1} of {STEPS.length}
      </Text>
      <ButtonGroup>
        <Button onClick={next}>{cur.cta}</Button>
        {onDismiss ? (
          <Button onClick={onDismiss} variant="tertiary">
            Dismiss
          </Button>
        ) : null}
      </ButtonGroup>
    </Card>
  );
}
