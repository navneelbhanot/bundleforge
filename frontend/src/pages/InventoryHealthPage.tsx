import { useEffect, useState } from "react";
import { Card, Page, Spinner, Text, Badge, InlineStack } from "@shopify/polaris";

interface Health {
  shopId: string;
  counts: { synced: number; pending: number; error: number; locked: number };
}

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
  const { counts } = health;
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
