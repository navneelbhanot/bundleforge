import { useEffect, useState } from "react";
import {
  Card,
  Page,
  Text,
  Badge,
  Button,
  Layout,
  InlineStack,
} from "@shopify/polaris";

import { PageLoading } from "../components/PageLoading";

interface PlanCaps {
  maxBundles: number | null;
  maxOrdersPerMonth: number | null;
  monthlyPriceUsd: number;
  annualPriceUsd: number;
  trialDays: number;
}
interface PlanRow {
  name: string;
  caps: PlanCaps;
  features: Record<string, boolean>;
}
interface BillingState {
  plan: string;
  caps: PlanCaps;
  subscription: { status: string; billingInterval: string } | null;
}

export function BillingPage(): JSX.Element {
  const [state, setState] = useState<BillingState | null>(null);
  const [plans, setPlans] = useState<PlanRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch("/api/v1/billing").then((r) => r.json() as Promise<BillingState>),
      fetch("/api/v1/billing/plans").then((r) => r.json() as Promise<PlanRow[] | { data?: PlanRow[] }>),
    ])
      .then(([s, p]) => {
        setState(s);
        // Tolerate both `[...]` (current API) and `{data: [...]}` (the
        // generic envelope used by other endpoints) so a future API
        // change doesn't crash the page with .filter undefined.
        const planList = Array.isArray(p)
          ? p
          : Array.isArray((p as { data?: PlanRow[] })?.data)
            ? ((p as { data?: PlanRow[] }).data as PlanRow[])
            : [];
        setPlans(planList);
      })
      .catch((e: Error) => setError(e.message));
  }, []);

  async function subscribe(plan: string, interval: "monthly" | "annual"): Promise<void> {
    setBusy(true);
    try {
      const res = await fetch("/api/v1/billing/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan, interval }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = (await res.json()) as { confirmationUrl: string };
      window.location.href = body.confirmationUrl;
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  if (error && !state) {
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
  if (!state || !plans) {
    return <PageLoading title="Billing" variant="detail" primaryAction={false} />;
  }
  return (
    <Page title="Billing">
      <Layout>
        <Layout.Section>
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
        </Layout.Section>
        {plans
          .filter((p) => p.name !== "starter")
          .map((p) => (
            <Layout.Section key={p.name}>
              <Card>
                <Text as="h3" variant="headingMd">
                  {p.name}
                </Text>
                <Text as="p">
                  ${p.caps.monthlyPriceUsd}/mo &nbsp; or &nbsp; $
                  {p.caps.annualPriceUsd}/yr
                </Text>
                <InlineStack gap="200">
                  <Button
                    onClick={() => subscribe(p.name, "monthly")}
                    disabled={busy}
                  >
                    Subscribe monthly
                  </Button>
                  <Button
                    onClick={() => subscribe(p.name, "annual")}
                    disabled={busy}
                    variant="primary"
                  >
                    Subscribe annual (20% off)
                  </Button>
                </InlineStack>
              </Card>
            </Layout.Section>
          ))}
      </Layout>
    </Page>
  );
}
