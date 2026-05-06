/**
 * Dashboard page (M-184) — the new app home at `/`.
 *
 * Composes seven widget cards from across the app's domains:
 * Revenue snapshot, Recent bundles, Bundle status, Inventory
 * health, Recent orders, AI suggestions, Recent activity. Each
 * widget owns its own fetch and renders independently — one
 * failure doesn't block the others.
 *
 * Falls back to the FreshShopDashboard welcome surface when the
 * shop has zero bundles and the merchant hasn't dismissed it.
 * BundlesListPage moved to /bundles.
 */
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { BlockStack, Frame, Grid, Page } from "@shopify/polaris";

import { FreshShopDashboard } from "../components/dashboard/FreshShopDashboard";
import { OnboardingWizard } from "../components/OnboardingWizard";
import { PageLoading } from "../components/PageLoading";
import {
  AiSuggestionsWidget,
  BundleCountsWidget,
  InventoryHealthWidget,
  RecentActivityWidget,
  RecentBundlesWidget,
  RecentOrdersWidget,
  RevenueSnapshotWidget,
} from "../components/dashboard/widgets";

const ONBOARDING_DISMISSED_KEY = "bundleforge:onboarding-dismissed";

function readDismissed(): boolean {
  try {
    return window.localStorage.getItem(ONBOARDING_DISMISSED_KEY) === "1";
  } catch {
    return false;
  }
}

function writeDismissed(): void {
  try {
    window.localStorage.setItem(ONBOARDING_DISMISSED_KEY, "1");
  } catch {
    // private mode / disabled — silently fall through.
  }
}

interface BundlesListResp {
  pagination: { total: number };
}

export function DashboardPage(): JSX.Element {
  const navigate = useNavigate();
  const [bundleTotal, setBundleTotal] = useState<number | null>(null);
  const [showWizard, setShowWizard] = useState(false);
  const [dismissed, setDismissed] = useState<boolean>(() => readDismissed());
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/v1/bundles?limit=1")
      .then((r) =>
        r.ok ? (r.json() as Promise<BundlesListResp>) : Promise.reject(new Error(`HTTP ${r.status}`)),
      )
      .then((j) => {
        if (!cancelled) setBundleTotal(j.pagination.total);
      })
      .catch((e: Error) => {
        if (!cancelled) setError(e.message);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleDismiss = (): void => {
    writeDismissed();
    setDismissed(true);
  };

  if (error) {
    return (
      <Page title="Dashboard">
        <BlockStack gap="400">
          <p style={{ color: "var(--p-color-text-critical)" }}>
            Couldn&apos;t load: {error}
          </p>
        </BlockStack>
      </Page>
    );
  }

  if (bundleTotal === null) {
    return <PageLoading title="Dashboard" variant="stats" />;
  }

  // Fresh shop branch — same logic as BundlesListPage uses.
  if (bundleTotal === 0 && !dismissed) {
    if (showWizard) {
      return (
        <Page title="Dashboard">
          <OnboardingWizard
            onComplete={() => navigate("/bundles/new")}
            onDismiss={() => setShowWizard(false)}
          />
        </Page>
      );
    }
    return (
      <Frame>
        <Page title="Dashboard">
          <FreshShopDashboard
            onCreate={() => navigate("/bundles/new")}
            onTour={() => setShowWizard(true)}
            onBrowseTemplates={() => navigate("/bundles?openTemplates=1")}
            onDismiss={handleDismiss}
          />
        </Page>
      </Frame>
    );
  }

  // Populated branch — the seven widgets.
  return (
    <Frame>
      <Page
        title="Dashboard"
        primaryAction={{ content: "Create bundle", url: "/bundles/new" }}
        secondaryActions={[{ content: "Browse bundles", url: "/bundles" }]}
      >
        <BlockStack gap="500">
          <Grid>
            <Grid.Cell columnSpan={{ xs: 6, sm: 6, md: 6, lg: 6, xl: 6 }}>
              <RevenueSnapshotWidget />
            </Grid.Cell>

            <Grid.Cell columnSpan={{ xs: 6, sm: 6, md: 4, lg: 4, xl: 4 }}>
              <BundleCountsWidget />
            </Grid.Cell>
            <Grid.Cell columnSpan={{ xs: 6, sm: 6, md: 4, lg: 4, xl: 4 }}>
              <InventoryHealthWidget />
            </Grid.Cell>
            <Grid.Cell columnSpan={{ xs: 6, sm: 6, md: 4, lg: 4, xl: 4 }}>
              <RecentBundlesWidget />
            </Grid.Cell>

            <Grid.Cell columnSpan={{ xs: 6, sm: 6, md: 6, lg: 6, xl: 6 }}>
              <RecentOrdersWidget />
            </Grid.Cell>
            <Grid.Cell columnSpan={{ xs: 6, sm: 6, md: 6, lg: 6, xl: 6 }}>
              <AiSuggestionsWidget />
            </Grid.Cell>

            <Grid.Cell columnSpan={{ xs: 6, sm: 6, md: 6, lg: 6, xl: 6 }}>
              <RecentActivityWidget />
            </Grid.Cell>
          </Grid>
        </BlockStack>
      </Page>
    </Frame>
  );
}
