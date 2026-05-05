import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Card, Page, Text, IndexTable, Layout } from "@shopify/polaris";

import { PageLoading } from "../components/PageLoading";

interface OrderDetail {
  id: string;
  shopifyOrderNumber: string;
  status: string;
  bundlePrice: string;
  originalPrice: string;
  discountAmount: string;
  currency: string;
  fulfillmentStatus: string;
  skuBreakdown: Array<{ sku: string | null; quantity: number; title: string | null }>;
  bundle?: { title: string; slug: string; type: string };
}

export function OrderDetailPage(): JSX.Element {
  const { id } = useParams<{ id: string }>();
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    fetch(`/api/v1/orders/${id}`)
      .then((r) =>
        r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`)),
      )
      .then(setOrder)
      .catch((e: Error) => setError(e.message));
  }, [id]);

  if (error) {
    return (
      <Page title="Order">
        <Card>
          <Text as="p" tone="critical">
            {error}
          </Text>
        </Card>
      </Page>
    );
  }
  if (!order) {
    return <PageLoading title="Order" variant="detail" primaryAction={false} />;
  }

  return (
    <Page
      title={order.shopifyOrderNumber}
      subtitle={`${order.status} · ${order.fulfillmentStatus}`}
      backAction={{ content: "Orders", url: "/orders" }}
    >
      <Layout>
        <Layout.Section>
          <Card>
            <Text as="h2" variant="headingMd">
              Totals
            </Text>
            <Text as="p">
              Bundle price: {order.bundlePrice} {order.currency}
            </Text>
            <Text as="p">
              Original price: {order.originalPrice} {order.currency}
            </Text>
            <Text as="p">
              Discount: {order.discountAmount} {order.currency}
            </Text>
          </Card>
        </Layout.Section>
        <Layout.Section>
          <Card>
            <Text as="h2" variant="headingMd">
              SKU breakdown
            </Text>
            <IndexTable
              itemCount={order.skuBreakdown.length}
              headings={[{ title: "SKU" }, { title: "Title" }, { title: "Quantity" }]}
              selectable={false}
            >
              {order.skuBreakdown.map((s, i) => (
                <IndexTable.Row id={String(i)} key={i} position={i}>
                  <IndexTable.Cell>{s.sku ?? "—"}</IndexTable.Cell>
                  <IndexTable.Cell>{s.title ?? "—"}</IndexTable.Cell>
                  <IndexTable.Cell>{s.quantity}</IndexTable.Cell>
                </IndexTable.Row>
              ))}
            </IndexTable>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
