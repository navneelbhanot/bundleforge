/**
 * Shared Billing surface (M-167).
 *
 * Inner content for both the standalone /billing route and the
 * Billing tab in /settings#billing. Keeps the data fetching + UI
 * in one place so the two surfaces never drift.
 */
import { useEffect, useState } from "react";
import {
  Badge,
  Banner,
  BlockStack,
  Button,
  Card,
  InlineStack,
  Layout,
  Text,
} from "@shopify/polaris";

interface PlanCaps {
  maxBundles: number | null;
  maxOrdersPerMonth: number | null;
  monthlyPriceUsd: number;
  annualPriceUsd: number;
  trialDays: number;
}
export interface PlanRow {
  name: string;
  caps: PlanCaps;
  features: Record<string, boolean>;
}
export interface BillingState {
  plan: string;
  caps: PlanCaps;
  subscription: { status: string; billingInterval: string } | null;
}

export interface BillingPanelLoading {
  loading: true;
}
export interface BillingPanelError {
  loading: false;
  error: string;
}
export interface BillingPanelData {
  loading: false;
  state: BillingState;
  plans: PlanRow[];
}

interface BillingPanelProps {
  /**
   * Data injection seam for tests + for the Settings page (which
   * already manages its own loading state). When omitted, the panel
   * fetches itself.
   */
  data?: BillingPanelLoading | BillingPanelError | BillingPanelData;
}

function tolerantPlanList(
  p: PlanRow[] | { data?: PlanRow[] },
): PlanRow[] {
  if (Array.isArray(p)) return p;
  const wrapped = (p as { data?: PlanRow[] })?.data;
  return Array.isArray(wrapped) ? wrapped : [];
}

export function BillingPanel({ data }: BillingPanelProps = {}): JSX.Element {
  const [state, setState] = useState<BillingState | null>(null);
  const [plans, setPlans] = useState<PlanRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  /**
   * Separate slot for action-time errors (Subscribe / Cancel).
   * `error` triggers the full-card error replacement when there's
   * no loaded state; `actionError` renders as a Banner above the
   * loaded UI so the merchant doesn't lose the cards underneath.
   */
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const externalData = data;

  useEffect(() => {
    if (externalData) return; // controlled mode — parent feeds data
    Promise.all([
      fetch("/api/v1/billing").then((r) => r.json() as Promise<BillingState>),
      fetch("/api/v1/billing/plans").then(
        (r) => r.json() as Promise<PlanRow[] | { data?: PlanRow[] }>,
      ),
    ])
      .then(([s, p]) => {
        setState(s);
        setPlans(tolerantPlanList(p));
      })
      .catch((e: Error) => setError(e.message));
  }, [externalData]);

  /**
   * Try to extract a useful error message from a non-2xx Response.
   * Reads the JSON body when present and falls back to the status
   * text — anything is more useful than "HTTP 500".
   */
  async function readErrorBody(res: Response): Promise<string> {
    try {
      const ct = res.headers.get("content-type") ?? "";
      if (ct.includes("application/json")) {
        const j = (await res.json()) as {
          error?: { message?: string; code?: string };
          message?: string;
        };
        if (j.error?.message) return j.error.message;
        if (j.message) return j.message;
      } else {
        const t = await res.text();
        if (t.trim()) return t.trim();
      }
    } catch {
      // fall through
    }
    return `HTTP ${res.status}`;
  }

  async function subscribe(
    plan: string,
    interval: "monthly" | "annual",
  ): Promise<void> {
    setBusy(true);
    setActionError(null);
    try {
      const res = await fetch("/api/v1/billing/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan, interval }),
      });
      if (!res.ok) {
        const message = await readErrorBody(res);
        throw new Error(`Subscribe failed (${res.status}): ${message}`);
      }
      const body = (await res.json()) as { confirmationUrl?: string };
      if (!body.confirmationUrl) {
        throw new Error(
          "Subscribe response missing confirmationUrl — Shopify did not return a charge.",
        );
      }
      // Shopify's confirmation page is outside the embedded admin —
      // top-level navigation is required (App Bridge will not embed
      // an external charge page in an iframe).
      window.top
        ? (window.top.location.href = body.confirmationUrl)
        : (window.location.href = body.confirmationUrl);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      // Console for power users; banner for everyone else.
      // eslint-disable-next-line no-console
      console.error("[BillingPanel.subscribe]", e);
      setActionError(msg);
    } finally {
      setBusy(false);
    }
  }

  // Decide what to render. Controlled mode (`data` prop) takes
  // precedence; uncontrolled mode falls back to internal state.
  let resolved: BillingPanelLoading | BillingPanelError | BillingPanelData;
  if (externalData) {
    resolved = externalData;
  } else if (error && !state) {
    resolved = { loading: false, error };
  } else if (!state || !plans) {
    resolved = { loading: true };
  } else {
    resolved = { loading: false, state, plans };
  }

  if (resolved.loading) {
    return (
      <Card>
        <Text as="p" tone="subdued">
          Loading billing…
        </Text>
      </Card>
    );
  }
  if ("error" in resolved) {
    return (
      <Card>
        <Text as="p" tone="critical">
          {resolved.error}
        </Text>
      </Card>
    );
  }

  return (
    <Layout>
      {actionError ? (
        <Layout.Section>
          <Banner
            tone="critical"
            title="We couldn't start the subscription"
            onDismiss={() => setActionError(null)}
          >
            <Text as="p">{actionError}</Text>
          </Banner>
        </Layout.Section>
      ) : null}
      <Layout.Section>
        <Card>
          <BlockStack gap="200">
            <Text as="h2" variant="headingMd">
              Current plan: {resolved.state.plan}
            </Text>
            {resolved.state.subscription ? (
              <Badge tone="success">
                {`${resolved.state.subscription.status} — ${resolved.state.subscription.billingInterval}`}
              </Badge>
            ) : (
              <Badge tone="info">Free</Badge>
            )}
          </BlockStack>
        </Card>
      </Layout.Section>
      {resolved.plans
        .filter((p) => p.name !== "starter")
        .map((p) => (
          <Layout.Section key={p.name}>
            <Card>
              <BlockStack gap="200">
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
              </BlockStack>
            </Card>
          </Layout.Section>
        ))}
    </Layout>
  );
}
