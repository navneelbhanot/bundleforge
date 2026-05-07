/**
 * Shared Billing surface (M-167, redesigned in M-204).
 *
 * Inner content for both the standalone /billing route and the
 * Billing tab in /settings#billing. Holds data fetching + composes
 * the new plan-comparison grid (PlanCard × 4 + IntervalToggle).
 */
import { useEffect, useState } from "react";
import {
  Badge,
  Banner,
  BlockStack,
  Card,
  Grid,
  InlineStack,
  Layout,
  Text,
} from "@shopify/polaris";

import { IntervalToggle, type BillingInterval } from "./billing/IntervalToggle";
import { PlanCard } from "./billing/PlanCard";

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
  /**
   * Default to annual — it's the discount-favouring choice and
   * matches the conversion goal. Merchants who want monthly can
   * still flip the toggle.
   */
  const [interval, setInterval] = useState<BillingInterval>("annual");
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
      if (window.top) {
        window.top.location.href = body.confirmationUrl;
      } else {
        window.location.href = body.confirmationUrl;
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      // Console for power users; banner for everyone else.
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

      {/* Header row: current-plan summary + interval toggle. */}
      <Layout.Section>
        <Card>
          <InlineStack
            align="space-between"
            blockAlign="center"
            wrap={false}
            gap="400"
          >
            <BlockStack gap="100">
              <Text as="h2" variant="headingMd">
                Choose a plan
              </Text>
              <InlineStack gap="200" blockAlign="center" wrap={false}>
                <Text as="span" tone="subdued" variant="bodyMd">
                  Current plan:
                </Text>
                <Badge tone="success">{resolved.state.plan}</Badge>
                {resolved.state.subscription ? (
                  <Text as="span" tone="subdued" variant="bodyMd">
                    {`${resolved.state.subscription.status} · ${resolved.state.subscription.billingInterval}`}
                  </Text>
                ) : null}
              </InlineStack>
            </BlockStack>
            <IntervalToggle value={interval} onChange={setInterval} />
          </InlineStack>
        </Card>
      </Layout.Section>

      {/* Plan comparison grid: 4 cards across at lg/xl, 2 across at
          md, single column on mobile. */}
      <Layout.Section>
        <Grid>
          {resolved.plans.map((p) => (
            <Grid.Cell
              key={p.name}
              columnSpan={{ xs: 6, sm: 6, md: 3, lg: 3, xl: 3 }}
            >
              <PlanCard
                plan={p}
                currentPlan={resolved.state.plan}
                interval={interval}
                busy={busy}
                onSubscribe={subscribe}
              />
            </Grid.Cell>
          ))}
        </Grid>
      </Layout.Section>

      {/* Reassurance / fine print. */}
      <Layout.Section>
        <Card>
          <BlockStack gap="200">
            <Text as="h3" variant="headingSm">
              All plans include
            </Text>
            <BlockStack gap="100">
              <Text as="p" variant="bodyMd">
                ✓ All bundle types: fixed, multipack, mix &amp; match,
                build-a-box, volume discounts, BOGO, gift-with-purchase
              </Text>
              <Text as="p" variant="bodyMd">
                ✓ Cart Transform pricing at checkout
              </Text>
              <Text as="p" variant="bodyMd">
                ✓ Checkout Guardian (atomic bundle composition)
              </Text>
              <Text as="p" variant="bodyMd">
                ✓ 14-language storefront i18n
              </Text>
              <Text as="p" variant="bodyMd">
                ✓ App proxy (custom storefront integration)
              </Text>
            </BlockStack>
            <Text as="p" tone="subdued" variant="bodySm">
              Annual billing is non-refundable after 30 days. See{" "}
              <a href="/legal/terms-of-service.md">Terms of Service §3.1</a>{" "}
              for fair-use details on unlimited paid plans.
            </Text>
          </BlockStack>
        </Card>
      </Layout.Section>
    </Layout>
  );
}
