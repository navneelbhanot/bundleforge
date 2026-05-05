import { AppProvider } from "@shopify/polaris";
import { BrowserRouter, Routes, Route, Link } from "react-router-dom";

import { AppBridgeProvider } from "./AppBridgeProvider";
import { BundlesListPage } from "./pages/BundlesListPage";
import { BundleDetailPage } from "./pages/BundleDetailPage";
import { OrdersListPage } from "./pages/OrdersListPage";
import { SettingsPage } from "./pages/SettingsPage";
import { BillingPage } from "./pages/BillingPage";

const i18n = { Polaris: { Common: { cancel: "Cancel", save: "Save" } } };

export function App() {
  return (
    <AppBridgeProvider>
      <AppProvider i18n={i18n}>
        <BrowserRouter>
          <header style={{ padding: "1rem", borderBottom: "1px solid #ddd" }}>
            <nav style={{ display: "flex", gap: "1rem" }}>
              <Link to="/">Bundles</Link>
              <Link to="/orders">Orders</Link>
              <Link to="/settings">Settings</Link>
              <Link to="/billing">Billing</Link>
            </nav>
          </header>
          <main style={{ padding: "1rem" }}>
            <Routes>
              <Route path="/" element={<BundlesListPage />} />
              <Route path="/bundles/:id" element={<BundleDetailPage />} />
              <Route path="/orders" element={<OrdersListPage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="/billing" element={<BillingPage />} />
            </Routes>
          </main>
        </BrowserRouter>
      </AppProvider>
    </AppBridgeProvider>
  );
}
