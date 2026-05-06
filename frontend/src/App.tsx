import { useEffect, useState } from "react";
import { AppProvider, Tabs, Page, Box } from "@shopify/polaris";
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
import { BundlesListPage } from "./pages/BundlesListPage";
import { DashboardPage } from "./pages/DashboardPage";
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

const i18n = { Polaris: { Common: { cancel: "Cancel", save: "Save" } } };

interface NavTab {
  id: string;
  content: string;
  path: string;
  /** Sub-paths that should keep this tab selected. */
  prefixes?: string[];
}

const NAV_TABS: NavTab[] = [
  { id: "dashboard", content: "Dashboard", path: "/" },
  { id: "bundles", content: "Bundles", path: "/bundles", prefixes: ["/bundles"] },
  { id: "orders", content: "Orders", path: "/orders" },
  {
    id: "inventory",
    content: "Inventory",
    path: "/inventory",
    prefixes: ["/inventory"],
  },
  { id: "audit", content: "Audit", path: "/inventory/audit" },
  { id: "analytics", content: "Analytics", path: "/analytics" },
  { id: "ai", content: "AI suggestions", path: "/ai-suggestions" },
  { id: "abtests", content: "A/B", path: "/ab-tests" },
  { id: "settings", content: "Settings", path: "/settings" },
  { id: "billing", content: "Billing", path: "/billing" },
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
  const selected = pickSelected(location.pathname);
  return (
    <Box paddingBlockEnd="200">
      <Tabs
        tabs={NAV_TABS.map((t) => ({
          id: t.id,
          content: t.content,
          accessibilityLabel: t.content,
          panelID: `panel-${t.id}`,
        }))}
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
      </Routes>
      <CommandPalette />
      <HelpDrawer />
    </Page>
  );
}

export function App() {
  return (
    <AppBridgeProvider>
      <AppProvider i18n={i18n}>
        <ToastsProvider>
          <BrowserRouter>
            <Shell />
          </BrowserRouter>
        </ToastsProvider>
      </AppProvider>
    </AppBridgeProvider>
  );
}
