import { useEffect, useState } from "react";
import { Card, Page, Text, Spinner, Badge } from "@shopify/polaris";

interface BillingState {
  plan: string;
  subscription: { status: string; billingInterval: string } | null;
}

export function BillingPage(): JSX.Element {
  const [state, setState] = useState<BillingState | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/v1/billing")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then(setState)
      .catch((e: Error) => setError(e.message));
  }, []);

  if (error) {
    return (
      <Page title="Billing">
        <Card>
          <Text as="p" tone="critical">
            {error}
          </Text>
        </Card>
      </Page>
    );
  }
  if (!state) {
    return (
      <Page title="Billing">
        <Card>
          <Spinner accessibilityLabel="Loading billing" />
        </Card>
      </Page>
    );
  }
  return (
    <Page title="Billing">
      <Card>
        <Text as="h2" variant="headingMd">
          Current plan: {state.plan}
        </Text>
        {state.subscription ? (
          <Badge tone="success">
            {`${state.subscription.status} — ${state.subscription.billingInterval}`}
          </Badge>
        ) : (
          <Badge tone="info">Free</Badge>
        )}
      </Card>
    </Page>
  );
}
