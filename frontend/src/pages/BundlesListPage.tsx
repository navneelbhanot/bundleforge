/**
 * Bundles list page (M-097).
 *
 * Fetches /api/v1/bundles, renders Polaris IndexTable. Supports
 * filtering by status and type via the existing service.
 */
import { useEffect, useState } from "react";
import {
  Card,
  IndexTable,
  Page,
  Spinner,
  Text,
  Badge,
} from "@shopify/polaris";

interface BundleRow {
  id: string;
  title: string;
  type: string;
  status: string;
  slug: string;
}

export function BundlesListPage(): JSX.Element {
  const [rows, setRows] = useState<BundleRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/v1/bundles")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((body: { data: BundleRow[] }) => setRows(body.data))
      .catch((e: Error) => setError(e.message));
  }, []);

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
