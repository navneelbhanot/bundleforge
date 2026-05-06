/**
 * Billing page (M-108) — thin wrapper around the shared
 * BillingPanel (M-167). The Settings tab uses the same panel
 * inside the settings shell; the standalone /billing route uses it
 * inside a Polaris <Page> for direct navigation.
 */
import { Page } from "@shopify/polaris";

import { BillingPanel } from "../components/BillingPanel";

export function BillingPage(): JSX.Element {
  return (
    <Page title="Billing">
      <BillingPanel />
    </Page>
  );
}
