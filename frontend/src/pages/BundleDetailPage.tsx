/**
 * Bundle detail page (M-098).
 *
 * Loads /api/v1/bundles/:id and renders a Polaris layout with
 * type-specific config panel (M-100) + product picker (M-099).
 */
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Card, Page, Spinner, Text, Layout } from "@shopify/polaris";

import { ProductPicker } from "../components/ProductPicker";
import { TypeConfigPanel } from "../components/TypeConfigPanel";

interface BundleDetail {
  id: string;
  title: string;
  type: string;
  status: string;
  description: string | null;
  config: Record<string, unknown>;
  items: Array<{ id: string; title: string; shopifyProductGid: string; quantity: number }>;
}

export function BundleDetailPage(): JSX.Element {
  const { id } = useParams<{ id: string }>();
  const [bundle, setBundle] = useState<BundleDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    fetch(`/api/v1/bundles/${id}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then(setBundle)
      .catch((e: Error) => setError(e.message));
  }, [id]);

  if (error) {
    return (
      <Page title="Bundle">
        <Card>
          <Text as="p" tone="critical">
            {error}
          </Text>
        </Card>
      </Page>
    );
  }
  if (!bundle) {
    return (
      <Page title="Bundle">
        <Card>
          <Spinner accessibilityLabel="Loading bundle" />
        </Card>
      </Page>
    );
  }

  return (
    <Page
      title={bundle.title}
      subtitle={`${bundle.type} · ${bundle.status}`}
      backAction={{ content: "Bundles", url: "/" }}
    >
      <Layout>
        <Layout.Section>
          <TypeConfigPanel type={bundle.type} config={bundle.config} />
        </Layout.Section>
        <Layout.Section>
          <ProductPicker initial={bundle.items} />
        </Layout.Section>
      </Layout>
    </Page>
  );
}
