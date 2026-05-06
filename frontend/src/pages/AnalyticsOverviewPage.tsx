import { useEffect, useState } from "react";
import {
  Card,
  Page,
  Text,
  Layout,
  IndexTable,
} from "@shopify/polaris";

import { PageLoading } from "../components/PageLoading";
import { EmptyStateCard } from "../components/shell/EmptyStateCard";

interface Overview {
  totalRevenue: number;
  totalOrders: number;
  topBundles: Array<{ bundleId: string; revenue: number; orders: number }>;
}

function fmtMoney(n: unknown): string {
  return typeof n === "number" && Number.isFinite(n) ? n.toFixed(2) : "0.00";
}

export function AnalyticsOverviewPage(): JSX.Element {
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/v1/analytics/overview")
      .then((r) =>
        r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`)),
      )
      .then(setData)
      .catch((e: Error) => setError(e.message));
  }, []);

  if (error) {
    return (
      <Page title="Analytics">
        <Card>
          <Text as="p" tone="critical">
            {error}
          </Text>
        </Card>
      </Page>
    );
  }
  if (!data) {
    return <PageLoading title="Analytics" variant="stats" primaryAction={false} />;
  }
  const totalRevenue = typeof data.totalRevenue === "number" ? data.totalRevenue : 0;
  const totalOrders = typeof data.totalOrders === "number" ? data.totalOrders : 0;
  const topBundles = Array.isArray(data.topBundles) ? data.topBundles : [];

  if (totalOrders === 0 && topBundles.length === 0) {
    return (
      <Page title="Analytics">
        <EmptyStateCard
          illustration="analytics"
          heading="No bundle orders yet"
          body="Revenue and top bundles appear here after the first bundle order is paid. Until then, this page is intentionally blank."
          primaryAction={{ content: "Create a bundle", url: "/bundles/new" }}
        />
      </Page>
    );
  }

  return (
    <Page title="Analytics">
      <Layout>
        <Layout.Section>
          <Card>
            <Text as="h2" variant="headingMd">
              Total revenue
            </Text>
            <Text as="p" variant="heading2xl">
              ${fmtMoney(totalRevenue)}
            </Text>
          </Card>
        </Layout.Section>
        <Layout.Section>
          <Card>
            <Text as="h2" variant="headingMd">
              Total bundle orders
            </Text>
            <Text as="p" variant="heading2xl">
              {totalOrders}
            </Text>
          </Card>
        </Layout.Section>
        <Layout.Section>
          <Card>
            <Text as="h2" variant="headingMd">
              Top bundles
            </Text>
            <IndexTable
              itemCount={topBundles.length}
              headings={[
                { title: "Bundle" },
                { title: "Orders" },
                { title: "Revenue" },
              ]}
              selectable={false}
            >
              {topBundles.map((b, i) => (
                <IndexTable.Row id={b.bundleId} key={b.bundleId} position={i}>
                  <IndexTable.Cell>{b.bundleId}</IndexTable.Cell>
                  <IndexTable.Cell>{b.orders}</IndexTable.Cell>
                  <IndexTable.Cell>${fmtMoney(b.revenue)}</IndexTable.Cell>
                </IndexTable.Row>
              ))}
            </IndexTable>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
