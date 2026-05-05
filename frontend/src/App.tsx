import { AppProvider, Tabs, Page, Box } from "@shopify/polaris";
import {
  BrowserRouter,
  Routes,
  Route,
  useLocation,
  useNavigate,
} from "react-router-dom";

import { AppBridgeProvider } from "./AppBridgeProvider";
import { BundlesListPage } from "./pages/BundlesListPage";
import { BundleCreatePage } from "./pages/BundleCreatePage";
import { BundleDetailPage } from "./pages/BundleDetailPage";
import { OrdersListPage } from "./pages/OrdersListPage";
import { OrderDetailPage } from "./pages/OrderDetailPage";
import { InventoryAuditPage } from "./pages/InventoryAuditPage";
import { InventoryHealthPage } from "./pages/InventoryHealthPage";
import { AnalyticsOverviewPage } from "./pages/AnalyticsOverviewPage";
import { AbTestsPage } from "./pages/AbTestsPage";
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
  { id: "bundles", content: "Bundles", path: "/", prefixes: ["/bundles"] },
  { id: "orders", content: "Orders", path: "/orders" },
  {
    id: "inventory",
    content: "Inventory",
    path: "/inventory",
    prefixes: ["/inventory"],
  },
  { id: "audit", content: "Audit", path: "/inventory/audit" },
  { id: "analytics", content: "Analytics", path: "/analytics" },
  { id: "abtests", content: "A/B", path: "/ab-tests" },
  { id: "settings", content: "Settings", path: "/settings" },
  { id: "billing", content: "Billing", path: "/billing" },
];

function pickSelected(pathname: string): number {
  // Audit is a sub-path of /inventory; match it first so the Audit
  // tab wins over the parent Inventory tab.
  if (pathname === "/inventory/audit" || pathname.startsWith("/inventory/audit/")) {
    return NAV_TABS.findIndex((t) => t.id === "audit");
  }
  for (let i = 0; i < NAV_TABS.length; i += 1) {
    const t = NAV_TABS[i];
    if (pathname === t.path) return i;
    if (t.prefixes?.some((p) => pathname.startsWith(p + "/"))) return i;
  }
  return 0;
}

function NavTabs(): JSX.Element {
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

function Shell(): JSX.Element {
  return (
    <Page fullWidth>
      <NavTabs />
      <Routes>
        <Route path="/" element={<BundlesListPage />} />
        <Route path="/bundles/new" element={<BundleCreatePage />} />
        <Route path="/bundles/:id" element={<BundleDetailPage />} />
        <Route path="/orders" element={<OrdersListPage />} />
        <Route path="/orders/:id" element={<OrderDetailPage />} />
        <Route path="/inventory" element={<InventoryHealthPage />} />
        <Route path="/inventory/audit" element={<InventoryAuditPage />} />
        <Route path="/analytics" element={<AnalyticsOverviewPage />} />
        <Route path="/ab-tests" element={<AbTestsPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/billing" element={<BillingPage />} />
      </Routes>
    </Page>
  );
}

export function App() {
  return (
    <AppBridgeProvider>
      <AppProvider i18n={i18n}>
        <BrowserRouter>
          <Shell />
        </BrowserRouter>
      </AppProvider>
    </AppBridgeProvider>
  );
}
