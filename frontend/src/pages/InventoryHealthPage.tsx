import { useEffect, useState } from "react";
import {
  Card,
  EmptyState,
  Page,
  Spinner,
  Text,
  Badge,
  InlineStack,
} from "@shopify/polaris";

interface InventoryCounts {
  synced: number;
  pending: number;
  error: number;
  locked: number;
}

interface Health {
  shopId: string;
  counts: InventoryCounts;
}

const ZERO_COUNTS: InventoryCounts = {
  synced: 0,
  pending: 0,
  error: 0,
  locked: 0,
};

export function InventoryHealthPage(): JSX.Element {
  const [health, setHealth] = useState<Health | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/v1/inventory/health")
      .then((r) =>
        r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`)),
      )
      .then(setHealth)
      .catch((e: Error) => setError(e.message));
  }, []);

  if (error) {
    return (
      <Page title="Inventory health">
        <Card>
          <Text as="p" tone="critical">
            {error}
          </Text>
        </Card>
      </Page>
    );
  }
  if (!health) {
    return (
      <Page title="Inventory health">
        <Card>
          <Spinner accessibilityLabel="Loading health" />
        </Card>
      </Page>
    );
  }
  const counts = { ...ZERO_COUNTS, ...(health.counts ?? {}) };
  const total = counts.synced + counts.pending + counts.error + counts.locked;

  if (total === 0) {
    return (
      <Page title="Inventory health">
        <Card>
          <EmptyState
            heading="No inventory tracked yet"
            image=""
            action={{ content: "Create a bundle", url: "/bundles/new" }}
          >
            <p>
              Inventory state appears here once you publish a bundle and the
              first order is processed. Each component SKU gets a row.
            </p>
          </EmptyState>
        </Card>
      </Page>
    );
  }

  return (
    <Page title="Inventory health">
      <Card>
        <Text as="h2" variant="headingMd">
          Sync state by status
        </Text>
        <InlineStack gap="400">
          <Badge tone="success">{`Synced: ${counts.synced}`}</Badge>
          <Badge tone="info">{`Pending: ${counts.pending}`}</Badge>
          <Badge tone="warning">{`Locked: ${counts.locked}`}</Badge>
          <Badge tone="critical">{`Error: ${counts.error}`}</Badge>
        </InlineStack>
      </Card>
    </Page>
  );
}
