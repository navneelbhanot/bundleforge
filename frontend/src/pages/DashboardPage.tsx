/**
 * Dashboard page (M-184, onboarding checklist + language select
 * added in M-186) — the new app home at `/`.
 *
 * Composes seven widget cards from across the app's domains:
 * Revenue snapshot, Recent bundles, Bundle status, Inventory
 * health, Recent orders, AI suggestions, Recent activity. Each
 * widget owns its own fetch and renders independently — one
 * failure doesn't block the others.
 *
 * The setup checklist (M-186) renders above the widgets when the
 * shop hasn't dismissed it AND not all three steps are complete.
 * The app-language quick-select sits in the dashboard's top-right
 * area and writes `settings.localization.fallbackLocale`.
 *
 * Falls back to the FreshShopDashboard welcome surface when the
 * shop has zero bundles and the merchant hasn't dismissed it.
 * BundlesListPage moved to /bundles.
 */
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { BlockStack, Frame, Grid, InlineStack, Page } from "@shopify/polaris";

import { AppLanguageSelect } from "../components/dashboard/AppLanguageSelect";
import { FreshShopDashboard } from "../components/dashboard/FreshShopDashboard";
import {
  SetupChecklist,
  type ChecklistStep,
} from "../components/dashboard/SetupChecklist";
import { OnboardingWizard } from "../components/OnboardingWizard";
import { PageLoading } from "../components/PageLoading";
import { ToastHost, useToasts } from "../components/shell/Toasts";
import {
  AiSuggestionsWidget,
  BundleCountsWidget,
  InventoryHealthWidget,
  RecentActivityWidget,
  RecentBundlesWidget,
  RecentOrdersWidget,
  RevenueSnapshotWidget,
} from "../components/dashboard/widgets";

const FRESH_SHOP_DISMISS_KEY = "bundleforge:onboarding-dismissed";

function readFreshShopDismissed(): boolean {
  try {
    return window.localStorage.getItem(FRESH_SHOP_DISMISS_KEY) === "1";
  } catch {
    return false;
  }
}

function writeFreshShopDismissed(): void {
  try {
    window.localStorage.setItem(FRESH_SHOP_DISMISS_KEY, "1");
  } catch {
    // private mode / disabled — silently fall through.
  }
}

interface BundlesListResp {
  pagination: { total: number };
}

interface SettingsResp {
  general?: { shopifyDomain?: string };
  localization?: { fallbackLocale?: string };
  onboarding?: {
    blockAddedAt?: string | null;
    dismissedAt?: string | null;
  };
}

/**
 * Read the Shopify app's client_id from the meta tag the index.html
 * sets — same value that App Bridge uses to identify the app.
 * Used to construct the theme-editor deep-link.
 */
function readAppApiKey(): string | null {
  if (typeof document === "undefined") return null;
  const m = document.querySelector('meta[name="shopify-api-key"]');
  return m?.getAttribute("content") ?? null;
}

function themeEditorBlockUrl(domain: string | undefined): string | undefined {
  if (!domain) return undefined;
  const apiKey = readAppApiKey();
  const base = `https://${domain}/admin/themes/current/editor?template=product`;
  if (!apiKey) return base;
  return `${base}&addAppBlockId=${apiKey}/bundle-display&target=mainSection`;
}

export function DashboardPage(): JSX.Element {
  const navigate = useNavigate();
  const { show: showToast } = useToasts();
  const [bundleTotal, setBundleTotal] = useState<number | null>(null);
  const [activeTotal, setActiveTotal] = useState<number | null>(null);
  const [settings, setSettings] = useState<SettingsResp | null>(null);
  const [showWizard, setShowWizard] = useState(false);
  const [freshShopDismissed, setFreshShopDismissed] = useState<boolean>(() =>
    readFreshShopDismissed(),
  );
  const [error, setError] = useState<string | null>(null);
  const [savingLanguage, setSavingLanguage] = useState(false);
  const [savingChecklist, setSavingChecklist] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const all = Promise.all([
      fetch("/api/v1/bundles?limit=1").then((r) =>
        r.ok ? (r.json() as Promise<BundlesListResp>) : Promise.reject(new Error(`HTTP ${r.status}`)),
      ),
      fetch("/api/v1/bundles?status=active&limit=1").then((r) =>
        r.ok ? (r.json() as Promise<BundlesListResp>) : Promise.reject(new Error(`HTTP ${r.status}`)),
      ),
      fetch("/api/v1/settings").then((r) =>
        r.ok ? (r.json() as Promise<SettingsResp>) : Promise.reject(new Error(`HTTP ${r.status}`)),
      ),
    ]);
    all
      .then(([bundles, activeBundles, set]) => {
        if (cancelled) return;
        setBundleTotal(bundles.pagination.total);
        setActiveTotal(activeBundles.pagination.total);
        setSettings(set);
      })
      .catch((e: Error) => {
        if (!cancelled) setError(e.message);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function patchSettings(patch: object): Promise<SettingsResp | null> {
    const res = await fetch("/api/v1/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return (await res.json()) as SettingsResp;
  }

  async function handleLanguageChange(next: string): Promise<void> {
    setSavingLanguage(true);
    try {
      await patchSettings({
        localization: { fallbackLocale: next },
      });
      // Cache the chosen locale in localStorage so App.tsx can
      // read it SYNCHRONOUSLY on the next render — no fetch
      // race with App Bridge's session-token handshake. Then
      // reload to remount Polaris's AppProvider with the new
      // i18n bundle.
      try {
        window.localStorage.setItem(
          "bundleforge:polaris-locale",
          next,
        );
      } catch {
        // private mode / disabled — silently continue.
      }
      showToast("Language saved — refreshing…");
      window.setTimeout(() => {
        window.location.reload();
      }, 600);
    } catch (e) {
      showToast(`Couldn't save language: ${(e as Error).message}`, {
        error: true,
      });
      setSavingLanguage(false);
    }
  }

  async function handleMarkBlockComplete(): Promise<void> {
    setSavingChecklist(true);
    try {
      const merged = await patchSettings({
        onboarding: { blockAddedAt: new Date().toISOString() },
      });
      if (merged) setSettings(merged);
    } catch (e) {
      showToast(`Couldn't save: ${(e as Error).message}`, { error: true });
    } finally {
      setSavingChecklist(false);
    }
  }

  async function handleDismissChecklist(): Promise<void> {
    setSavingChecklist(true);
    try {
      const merged = await patchSettings({
        onboarding: { dismissedAt: new Date().toISOString() },
      });
      if (merged) setSettings(merged);
    } catch (e) {
      showToast(`Couldn't dismiss: ${(e as Error).message}`, { error: true });
    } finally {
      setSavingChecklist(false);
    }
  }

  const handleFreshShopDismiss = (): void => {
    writeFreshShopDismissed();
    setFreshShopDismissed(true);
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

  if (bundleTotal === null || activeTotal === null || settings === null) {
    return <PageLoading title="Dashboard" variant="stats" />;
  }

  // Fresh shop branch — same logic as BundlesListPage uses.
  if (bundleTotal === 0 && !freshShopDismissed) {
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
            onDismiss={handleFreshShopDismiss}
          />
        </Page>
      </Frame>
    );
  }

  // Populated branch — checklist + seven widgets.
  const onboarding = settings.onboarding ?? {};
  const fallbackLocale = settings.localization?.fallbackLocale ?? "en";
  const editorUrl = themeEditorBlockUrl(settings.general?.shopifyDomain);

  const checklistSteps: ChecklistStep[] = [
    {
      id: "create",
      title: "Create your first bundle",
      body: "Pick a bundle type, add components, set pricing.",
      done: bundleTotal > 0,
      primary: { label: "Create bundle", url: "/bundles/new" },
    },
    {
      id: "publish",
      title: "Publish a bundle",
      body: "Drafts don't sell. Set a bundle's status to Active to start showing it on your storefront.",
      done: activeTotal > 0,
      primary: { label: "Browse bundles", url: "/bundles" },
    },
    {
      id: "block",
      title: "Add the Bundle block to your storefront",
      body: "Drop the BundleForge block into your product page template so shoppers see it.",
      done: Boolean(onboarding.blockAddedAt),
      primary: editorUrl
        ? { label: "Open theme editor", url: editorUrl, external: true }
        : undefined,
      secondary: {
        label: "Mark complete",
        onClick: () => void handleMarkBlockComplete(),
      },
    },
  ];

  return (
    <Frame>
      <Page
        title="Dashboard"
        primaryAction={{ content: "Create bundle", url: "/bundles/new" }}
        secondaryActions={[{ content: "Browse bundles", url: "/bundles" }]}
      >
        <BlockStack gap="500">
          <InlineStack align="end" blockAlign="center">
            <AppLanguageSelect
              value={fallbackLocale}
              busy={savingLanguage}
              onChange={(next) => void handleLanguageChange(next)}
            />
          </InlineStack>

          <SetupChecklist
            steps={checklistSteps}
            dismissed={Boolean(onboarding.dismissedAt)}
            onDismiss={() => void handleDismissChecklist()}
            busy={savingChecklist}
          />

          {/*
           * Layout — top to bottom:
           *   - Revenue snapshot full-width (marquee)
           *   - 3 stat cards across (Bundle status / Inventory / Recent bundles)
           *   - 2 list cards across (Recent orders / AI suggestions)
           *   - Recent activity full-width
           * Polaris Grid columnSpan max is 6, so at lg/xl breakpoints
           * 6 = 50%. Full-width rows render the widget outside the
           * Grid; column rows use Grid with explicit thirds/halves.
           */}
          <RevenueSnapshotWidget />

          <Grid>
            {/* Thirds: md/6 col → span 2; lg/xl 12 col → span 4 */}
            <Grid.Cell columnSpan={{ xs: 6, sm: 6, md: 2, lg: 4, xl: 4 }}>
              <BundleCountsWidget />
            </Grid.Cell>
            <Grid.Cell columnSpan={{ xs: 6, sm: 6, md: 2, lg: 4, xl: 4 }}>
              <InventoryHealthWidget />
            </Grid.Cell>
            <Grid.Cell columnSpan={{ xs: 6, sm: 6, md: 2, lg: 4, xl: 4 }}>
              <RecentBundlesWidget />
            </Grid.Cell>
          </Grid>

          <Grid>
            {/* Halves: md/6 col → span 3; lg/xl 12 col → span 6 */}
            <Grid.Cell columnSpan={{ xs: 6, sm: 6, md: 3, lg: 6, xl: 6 }}>
              <RecentOrdersWidget />
            </Grid.Cell>
            <Grid.Cell columnSpan={{ xs: 6, sm: 6, md: 3, lg: 6, xl: 6 }}>
              <AiSuggestionsWidget />
            </Grid.Cell>
          </Grid>

          <RecentActivityWidget />
        </BlockStack>
      </Page>
      <ToastHost />
    </Frame>
  );
}
