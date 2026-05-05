import { useEffect, useState } from "react";
import { Card, Page, Spinner, Text, Layout, IndexTable } from "@shopify/polaris";

interface Overview {
  totalRevenue: number;
  totalOrders: number;
  topBundles: Array<{ bundleId: string; revenue: number; orders: number }>;
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
    return (
      <Page title="Analytics">
        <Card>
          <Spinner accessibilityLabel="Loading" />
        </Card>
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
              ${data.totalRevenue.toFixed(2)}
            </Text>
          </Card>
        </Layout.Section>
        <Layout.Section>
          <Card>
            <Text as="h2" variant="headingMd">
              Total bundle orders
            </Text>
            <Text as="p" variant="heading2xl">
              {data.totalOrders}
            </Text>
          </Card>
        </Layout.Section>
        <Layout.Section>
          <Card>
            <Text as="h2" variant="headingMd">
              Top bundles
            </Text>
            <IndexTable
              itemCount={data.topBundles.length}
              headings={[
                { title: "Bundle" },
                { title: "Orders" },
                { title: "Revenue" },
              ]}
              selectable={false}
            >
              {data.topBundles.map((b, i) => (
                <IndexTable.Row id={b.bundleId} key={b.bundleId} position={i}>
                  <IndexTable.Cell>{b.bundleId}</IndexTable.Cell>
                  <IndexTable.Cell>{b.orders}</IndexTable.Cell>
                  <IndexTable.Cell>${b.revenue.toFixed(2)}</IndexTable.Cell>
                </IndexTable.Row>
              ))}
            </IndexTable>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
