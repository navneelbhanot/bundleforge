import { useEffect, useState } from "react";
import {
  Card,
  EmptyState,
  IndexTable,
  Page,
  Spinner,
  Text,
  Badge,
} from "@shopify/polaris";

interface AuditRow {
  id: string;
  action: string;
  reason: string;
  source: string;
  quantityBefore: number;
  quantityAfter: number;
  quantityDelta: number;
  createdAt: string;
}

export function InventoryAuditPage(): JSX.Element {
  const [rows, setRows] = useState<AuditRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/v1/inventory/audit")
      .then((r) =>
        r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`)),
      )
      .then((body: { data?: AuditRow[] }) => setRows(Array.isArray(body?.data) ? body.data : []))
      .catch((e: Error) => setError(e.message));
  }, []);

  if (error) {
    return (
      <Page title="Inventory audit">
        <Card>
          <Text as="p" tone="critical">
            {error}
          </Text>
        </Card>
      </Page>
    );
  }
  if (!rows) {
    return (
      <Page title="Inventory audit">
        <Card>
          <Spinner accessibilityLabel="Loading audit" />
        </Card>
      </Page>
    );
  }
  if (rows.length === 0) {
    return (
      <Page title="Inventory audit">
        <Card>
          <EmptyState
            heading="No inventory events yet"
            image=""
            action={{ content: "Create a bundle", url: "/bundles/new" }}
          >
            <p>
              Every inventory adjustment writes an immutable row here, one per
              component SKU. This page populates after the first bundle order
              is processed.
            </p>
          </EmptyState>
        </Card>
      </Page>
    );
  }

  return (
    <Page title="Inventory audit">
      <Card>
        <IndexTable
          itemCount={rows.length}
          headings={[
            { title: "Action" },
            { title: "Reason" },
            { title: "Source" },
            { title: "Δ" },
            { title: "When" },
          ]}
          selectable={false}
        >
          {rows.map((r, i) => (
            <IndexTable.Row id={r.id} key={r.id} position={i}>
              <IndexTable.Cell>
                <Badge>{r.action}</Badge>
              </IndexTable.Cell>
              <IndexTable.Cell>{r.reason}</IndexTable.Cell>
              <IndexTable.Cell>{r.source}</IndexTable.Cell>
              <IndexTable.Cell>
                {r.quantityDelta > 0 ? `+${r.quantityDelta}` : r.quantityDelta}
              </IndexTable.Cell>
              <IndexTable.Cell>
                {new Date(r.createdAt).toLocaleString()}
              </IndexTable.Cell>
            </IndexTable.Row>
          ))}
        </IndexTable>
      </Card>
    </Page>
  );
}
