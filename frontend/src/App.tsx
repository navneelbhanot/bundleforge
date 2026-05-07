import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { AppProvider, Tabs, Page, Box } from "@shopify/polaris";

// Initialise i18next before anything imports useTranslation. The
// side-effect import does the work; we don't reference the
// exported instance here.
import "./lib/i18n";
import {
  BrowserRouter,
  Routes,
  Route,
  useLocation,
  useNavigate,
} from "react-router-dom";

import { AppBridgeProvider } from "./AppBridgeProvider";
import { CommandPalette } from "./components/CommandPalette";
import { HelpDrawer } from "./components/HelpDrawer";
import { NavMenu } from "./components/NavMenu";
import { ToastsProvider } from "./components/shell/Toasts";
import {
  LOCALE_CHANGED_EVENT,
  loadPolarisLocale,
  loadPolarisLocaleSync,
  type LocaleChangedDetail,
  type PolarisI18n,
} from "./lib/polarisLocale";
import { BundlesListPage } from "./pages/BundlesListPage";
import { DashboardPage } from "./pages/DashboardPage";
import { SupportPage } from "./pages/SupportPage";
import { BundleCreatePage } from "./pages/BundleCreatePage";
import { BundleDetailPage } from "./pages/BundleDetailPage";
import { OrdersListPage } from "./pages/OrdersListPage";
import { OrderDetailPage } from "./pages/OrderDetailPage";
import { InventoryAuditPage } from "./pages/InventoryAuditPage";
import { InventoryHealthPage } from "./pages/InventoryHealthPage";
import { AnalyticsOverviewPage } from "./pages/AnalyticsOverviewPage";
import { AbTestsPage } from "./pages/AbTestsPage";
import { AiSuggestionsPage } from "./pages/AiSuggestionsPage";
import { SettingsPage } from "./pages/SettingsPage";
import { BillingPage } from "./pages/BillingPage";

/**
 * Default Polaris i18n bundle (English) used while the merchant's
 * preferred locale is being read from localStorage / fetched.
 */
const FALLBACK_I18N: PolarisI18n = {
  Polaris: { Common: { cancel: "Cancel", save: "Save" } },
};

const LOCALE_CACHE_KEY = "mintbundle:polaris-locale";

interface SettingsLocaleResp {
  localization?: { fallbackLocale?: string };
}

function readCachedLocale(): string | null {
  try {
    return window.localStorage.getItem(LOCALE_CACHE_KEY);
  } catch {
    return null;
  }
}

function writeCachedLocale(locale: string): void {
  try {
    window.localStorage.setItem(LOCALE_CACHE_KEY, locale);
  } catch {
    // private mode / disabled — silently fall through.
  }
}

function usePolarisI18n(): PolarisI18n {
  // Read from localStorage SYNCHRONOUSLY on first render so the
  // very first paint is in the merchant's chosen language. This
  // matters in Shopify's embedded iframe where the App Bridge
  // session token can take ~1s to acquire — fetching settings
  // first would race with that handshake and the merchant would
  // see a flash of English.
  const [polarisI18n, setPolarisI18n] = useState<PolarisI18n>(() => {
    const cached = readCachedLocale();
    if (cached) {
      // Synchronous read of the static-imported pack — no fetch.
      // loadPolarisLocale is async-shaped but resolves immediately.
      // We use a sync helper to seed initial state.
      return loadPolarisLocaleSync(cached);
    }
    return FALLBACK_I18N;
  });
  useEffect(() => {
    let cancelled = false;
    async function applyLocale(locale: string): Promise<void> {
      const next = await loadPolarisLocale(locale);
      if (!cancelled) {
        setPolarisI18n(next);
        writeCachedLocale(locale);
      }
    }
    // Sync from server in the background — covers the case where
    // the merchant changed the locale on a different device.
    fetch("/api/v1/settings")
      .then((r) =>
        r.ok
          ? (r.json() as Promise<SettingsLocaleResp>)
          : Promise.reject(new Error(`HTTP ${r.status}`)),
      )
      .then((j) => {
        const locale = j.localization?.fallbackLocale ?? "en";
        const cached = readCachedLocale();
        // Only re-apply if it differs from what we already loaded
        // from cache — avoids a needless re-render.
        if (locale !== cached) return applyLocale(locale);
      })
      .catch(() => {
        // Auth not ready / network blip — keep cached locale.
      });
    // Live-swap path: dashboard event listener (defensive — the
    // dashboard now reloads after save, so this is dead-code-safe).
    function onLocaleChanged(e: Event): void {
      const detail = (e as CustomEvent<LocaleChangedDetail>).detail;
      if (detail?.locale) void applyLocale(detail.locale);
    }
    window.addEventListener(LOCALE_CHANGED_EVENT, onLocaleChanged);
    return () => {
      cancelled = true;
      window.removeEventListener(LOCALE_CHANGED_EVENT, onLocaleChanged);
    };
  }, []);
  return polarisI18n;
}

interface NavTab {
  id: string;
  /** i18n key under `nav.<key>` for the tab's display label. */
  i18nKey: string;
  path: string;
  /** Sub-paths that should keep this tab selected. */
  prefixes?: string[];
}

const NAV_TABS: NavTab[] = [
  { id: "dashboard", i18nKey: "dashboard", path: "/" },
  { id: "bundles", i18nKey: "bundles", path: "/bundles", prefixes: ["/bundles"] },
  { id: "orders", i18nKey: "orders", path: "/orders" },
  {
    id: "inventory",
    i18nKey: "inventory",
    path: "/inventory",
    prefixes: ["/inventory"],
  },
  { id: "audit", i18nKey: "audit", path: "/inventory/audit" },
  { id: "analytics", i18nKey: "analytics", path: "/analytics" },
  { id: "ai", i18nKey: "ai", path: "/ai-suggestions" },
  { id: "abtests", i18nKey: "abtests", path: "/ab-tests" },
  { id: "settings", i18nKey: "settings", path: "/settings" },
  { id: "billing", i18nKey: "billing", path: "/billing" },
  { id: "support", i18nKey: "support", path: "/support" },
];

function pickSelected(pathname: string): number {
  // Audit is a sub-path of /inventory; match it first so the Audit
  // tab wins over the parent Inventory tab.
  if (
    pathname === "/inventory/audit" ||
    pathname.startsWith("/inventory/audit/")
  ) {
    return NAV_TABS.findIndex((t) => t.id === "audit");
  }
  for (let i = 0; i < NAV_TABS.length; i += 1) {
    const t = NAV_TABS[i];
    if (pathname === t.path) return i;
    if (t.prefixes?.some((p) => pathname.startsWith(p + "/"))) return i;
  }
  return 0;
}

/**
 * In-app top-bar tabs. Rendered ONLY when the SPA isn't running inside
 * Shopify's admin iframe — there the App Bridge NavMenu owns the
 * navigation surface and showing the same items twice is just clutter.
 */
function InAppTabs(): JSX.Element {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();
  const selected = pickSelected(location.pathname);
  return (
    <Box paddingBlockEnd="200">
      <Tabs
        tabs={NAV_TABS.map((tab) => {
          const label = t(`nav.${tab.i18nKey}`);
          return {
            id: tab.id,
            content: label,
            accessibilityLabel: label,
            panelID: `panel-${tab.id}`,
          };
        })}
        selected={selected}
        onSelect={(i) => navigate(NAV_TABS[i].path)}
      />
    </Box>
  );
}

function useIsEmbedded(): boolean {
  const [embedded, setEmbedded] = useState(false);
  useEffect(() => {
    try {
      // Heuristic: when the page is inside a Shopify admin iframe,
      // window.top !== window. Outside the iframe (direct Railway URL,
      // Playwright, devtools open in a separate window) they're equal.
      if (typeof window !== "undefined" && window.top !== window) {
        setEmbedded(true);
      }
    } catch {
      // Cross-origin frame access throws on some browsers — that's
      // also a strong signal we're embedded.
      setEmbedded(true);
    }
  }, []);
  return embedded;
}

function Shell(): JSX.Element {
  const embedded = useIsEmbedded();
  return (
    <Page fullWidth>
      <NavMenu />
      {embedded ? null : <InAppTabs />}
      <Routes>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/bundles" element={<BundlesListPage />} />
        <Route path="/bundles/new" element={<BundleCreatePage />} />
        <Route path="/bundles/:id" element={<BundleDetailPage />} />
        <Route path="/orders" element={<OrdersListPage />} />
        <Route path="/orders/:id" element={<OrderDetailPage />} />
        <Route path="/inventory" element={<InventoryHealthPage />} />
        <Route path="/inventory/audit" element={<InventoryAuditPage />} />
        <Route path="/analytics" element={<AnalyticsOverviewPage />} />
        <Route path="/ai-suggestions" element={<AiSuggestionsPage />} />
        <Route path="/ab-tests" element={<AbTestsPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/billing" element={<BillingPage />} />
        <Route path="/support" element={<SupportPage />} />
      </Routes>
      <CommandPalette />
      <HelpDrawer />
    </Page>
  );
}

function AppInner(): JSX.Element {
  const polarisI18n = usePolarisI18n();
  return (
    <AppProvider i18n={polarisI18n as Record<string, never>}>
      <ToastsProvider>
        <BrowserRouter>
          <Shell />
        </BrowserRouter>
      </ToastsProvider>
    </AppProvider>
  );
}

export function App() {
  return (
    <AppBridgeProvider>
      <AppInner />
    </AppBridgeProvider>
  );
}
