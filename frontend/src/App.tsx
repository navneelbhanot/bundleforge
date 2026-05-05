import { AppProvider } from "@shopify/polaris";
import { BrowserRouter, Routes, Route, Link } from "react-router-dom";

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

export function App() {
  return (
    <AppBridgeProvider>
      <AppProvider i18n={i18n}>
        <BrowserRouter>
          <header style={{ padding: "1rem", borderBottom: "1px solid #ddd" }}>
            <nav style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
              <Link to="/">Bundles</Link>
              <Link to="/orders">Orders</Link>
              <Link to="/inventory">Inventory</Link>
              <Link to="/inventory/audit">Audit</Link>
              <Link to="/analytics">Analytics</Link>
              <Link to="/ab-tests">A/B</Link>
              <Link to="/settings">Settings</Link>
              <Link to="/billing">Billing</Link>
            </nav>
          </header>
          <main style={{ padding: "1rem" }}>
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
          </main>
        </BrowserRouter>
      </AppProvider>
    </AppBridgeProvider>
  );
}
