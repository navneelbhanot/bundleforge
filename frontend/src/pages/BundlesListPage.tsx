/**
 * Bundles list page (M-097).
 *
 * Fetches /api/v1/bundles, renders Polaris IndexTable. Supports
 * filtering by status and type via the existing service. Surfaces the
 * OnboardingWizard for fresh shops (zero bundles) until dismissed.
 */
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Card,
  IndexTable,
  Page,
  Spinner,
  Text,
  Badge,
} from "@shopify/polaris";

import { OnboardingWizard } from "../components/OnboardingWizard";

interface BundleRow {
  id: string;
  title: string;
  type: string;
  status: string;
  slug: string;
}

const ONBOARDING_DISMISSED_KEY = "bundleforge:onboarding-dismissed";

function readDismissed(): boolean {
  // localStorage is per-origin and persists across reloads; the wizard
  // re-appears across browsers (intentional for now).
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
    // private mode / disabled — silently fall through; the wizard will
    // re-appear on next load, which is acceptable.
  }
}

export function BundlesListPage(): JSX.Element {
  const navigate = useNavigate();
  const [rows, setRows] = useState<BundleRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [wizardDismissed, setWizardDismissed] = useState(readDismissed);

  useEffect(() => {
    fetch("/api/v1/bundles")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((body: { data: BundleRow[] }) => setRows(body.data))
      .catch((e: Error) => setError(e.message));
  }, []);

  function handleDismiss(): void {
    writeDismissed();
    setWizardDismissed(true);
  }

  function handleComplete(): void {
    handleDismiss();
    navigate("/bundles/new");
  }

  if (error) {
    return (
      <Page title="Bundles">
        <Card>
          <Text as="p" tone="critical">
            Failed to load: {error}
          </Text>
        </Card>
      </Page>
    );
  }
  if (rows === null) {
    return (
      <Page title="Bundles">
        <Card>
          <Spinner accessibilityLabel="Loading bundles" />
        </Card>
      </Page>
    );
  }

  // Fresh shop: no bundles yet AND wizard hasn't been dismissed. Show
  // the three-step orientation flow instead of the empty IndexTable.
  if (rows.length === 0 && !wizardDismissed) {
    return (
      <Page title="Bundles">
        <OnboardingWizard
          onComplete={handleComplete}
          onDismiss={handleDismiss}
        />
      </Page>
    );
  }

  return (
    <Page title="Bundles" primaryAction={{ content: "Create bundle", url: "/bundles/new" }}>
      <Card>
        <IndexTable
          itemCount={rows.length}
          headings={[
            { title: "Title" },
            { title: "Type" },
            { title: "Status" },
          ]}
          selectable={false}
        >
          {rows.map((b, i) => (
            <IndexTable.Row id={b.id} key={b.id} position={i}>
              <IndexTable.Cell>
                <Text as="span" fontWeight="semibold">
                  {b.title}
                </Text>
              </IndexTable.Cell>
              <IndexTable.Cell>{b.type}</IndexTable.Cell>
              <IndexTable.Cell>
                <Badge tone={b.status === "active" ? "success" : "info"}>
                  {b.status}
                </Badge>
              </IndexTable.Cell>
            </IndexTable.Row>
          ))}
        </IndexTable>
      </Card>
    </Page>
  );
}
