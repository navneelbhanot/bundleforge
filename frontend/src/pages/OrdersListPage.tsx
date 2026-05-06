import { useEffect, useState } from "react";
import {
  Card,
  IndexTable,
  Page,
  Text,
  Badge,
} from "@shopify/polaris";

import { PageLoading } from "../components/PageLoading";
import { EmptyStateCard } from "../components/shell/EmptyStateCard";

interface OrderRow {
  id: string;
  shopifyOrderNumber: string;
  status: string;
  bundlePrice: string;
  currency: string;
  createdAt: string;
}

export function OrdersListPage(): JSX.Element {
  const [rows, setRows] = useState<OrderRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/v1/orders")
      .then((r) =>
        r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`)),
      )
      .then((body: { data?: OrderRow[] }) => setRows(Array.isArray(body?.data) ? body.data : []))
      .catch((e: Error) => setError(e.message));
  }, []);

  if (error) {
    return (
      <Page title="Orders">
        <Card>
          <Text as="p" tone="critical">
            {error}
          </Text>
        </Card>
      </Page>
    );
  }
  if (rows === null) {
    return <PageLoading title="Orders" variant="list" primaryAction={false} />;
  }
  if (rows.length === 0) {
    return (
      <Page title="Orders">
        <EmptyStateCard
          illustration="orders"
          heading="No bundle orders yet"
          body="Orders containing a bundle appear here after checkout. Each row maps to a Shopify order with its bundle line items."
          primaryAction={{ content: "Create a bundle", url: "/bundles/new" }}
        />
      </Page>
    );
  }

  return (
    <Page title="Orders">
      <Card>
        <IndexTable
          itemCount={rows.length}
          headings={[
            { title: "Order" },
            { title: "Status" },
            { title: "Total" },
          ]}
          selectable={false}
        >
          {rows.map((o, i) => (
            <IndexTable.Row id={o.id} key={o.id} position={i}>
              <IndexTable.Cell>
                <Text as="span" fontWeight="semibold">
                  {o.shopifyOrderNumber}
                </Text>
              </IndexTable.Cell>
              <IndexTable.Cell>
                <Badge tone={o.status === "fulfilled" ? "success" : "info"}>
                  {o.status}
                </Badge>
              </IndexTable.Cell>
              <IndexTable.Cell>
                {o.bundlePrice} {o.currency}
              </IndexTable.Cell>
            </IndexTable.Row>
          ))}
        </IndexTable>
      </Card>
    </Page>
  );
}
