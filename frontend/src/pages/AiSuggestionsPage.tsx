/**
 * AI bundle suggestions page.
 *
 * Calls GET /api/v1/ai/suggested-bundles, which counts SKU-pair
 * co-occurrence across the shop's recent bundle_orders and ranks them
 * by frequency + lift. Renders each pair as a row with a "Create
 * bundle from this" CTA that pre-fills the create page with the two
 * SKUs it inferred.
 *
 * Fresh shops with no orders get an EmptyState explaining when the
 * suggestions kick in, instead of a blank table.
 */
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  BlockStack,
  Badge,
  Button,
  Card,
  EmptyState,
  IndexTable,
  InlineStack,
  Page,
  Text,
} from "@shopify/polaris";

import { PageLoading } from "../components/PageLoading";

interface Pair {
  skuA: string;
  skuB: string;
  count: number;
  support: number;
  lift: number;
}

interface SuggestionsResponse {
  pairs: Pair[];
  totalBaskets: number;
  reason?: string;
}

function liftBadgeTone(lift: number): "success" | "info" | "attention" {
  if (lift >= 3) return "success";
  if (lift >= 1.5) return "info";
  return "attention";
}

function formatLift(lift: number): string {
  if (!Number.isFinite(lift) || lift <= 0) return "—";
  return `${lift.toFixed(1)}×`;
}

function formatSupport(support: number): string {
  return `${(support * 100).toFixed(1)}%`;
}

export function AiSuggestionsPage(): JSX.Element {
  const navigate = useNavigate();
  const [data, setData] = useState<SuggestionsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/v1/ai/suggested-bundles?topN=10")
      .then((r) =>
        r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`)),
      )
      .then((body: SuggestionsResponse) => setData(body))
      .catch((e: Error) => setError(e.message));
  }, []);

  if (error) {
    return (
      <Page title="AI suggestions">
        <Card>
          <Text as="p" tone="critical">
            Failed to load: {error}
          </Text>
        </Card>
      </Page>
    );
  }
  if (data === null) {
    return <PageLoading title="AI suggestions" variant="list" />;
  }

  if (data.pairs.length === 0) {
    return (
      <Page title="AI suggestions">
        <Card>
          <EmptyState
            heading="No suggestions yet"
            action={{
              content: "Create a bundle manually",
              onAction: () => navigate("/bundles/new"),
            }}
            image=""
          >
            <p>
              Suggestions appear once your shop has bundle orders to
              learn from. We count which products customers buy
              together across your recent orders, then rank pairs by
              co-occurrence and lift. Until then, create bundles
              manually using the picker on the create page.
            </p>
          </EmptyState>
        </Card>
      </Page>
    );
  }

  return (
    <Page
      title="AI suggestions"
      subtitle={`Ranked from ${data.totalBaskets.toLocaleString()} recent baskets`}
    >
      <BlockStack gap="400">
        <Card>
          <BlockStack gap="200">
            <Text as="h2" variant="headingSm">
              How this works
            </Text>
            <Text as="p" tone="subdued">
              We scan up to 1,000 recent bundle orders and look for
              pairs of products that customers buy together more often
              than chance. Lift means "how many times more likely than
              random" — anything above 1.5× is a real signal.
            </Text>
          </BlockStack>
        </Card>

        <Card padding="0">
          <IndexTable
            itemCount={data.pairs.length}
            headings={[
              { title: "Product A" },
              { title: "Product B" },
              { title: "Co-occurrences" },
              { title: "Support" },
              { title: "Lift" },
              { title: "" },
            ]}
            selectable={false}
          >
            {data.pairs.map((p, i) => (
              <IndexTable.Row id={`${p.skuA}|${p.skuB}`} key={i} position={i}>
                <IndexTable.Cell>
                  <Text as="span" fontWeight="semibold">
                    {p.skuA}
                  </Text>
                </IndexTable.Cell>
                <IndexTable.Cell>
                  <Text as="span" fontWeight="semibold">
                    {p.skuB}
                  </Text>
                </IndexTable.Cell>
                <IndexTable.Cell>{p.count.toLocaleString()}</IndexTable.Cell>
                <IndexTable.Cell>{formatSupport(p.support)}</IndexTable.Cell>
                <IndexTable.Cell>
                  <Badge tone={liftBadgeTone(p.lift)}>
                    {formatLift(p.lift)}
                  </Badge>
                </IndexTable.Cell>
                <IndexTable.Cell>
                  <InlineStack gap="200">
                    <Button
                      onClick={() =>
                        navigate("/bundles/new", {
                          state: {
                            suggestedSkus: [p.skuA, p.skuB],
                            suggestedFromAi: true,
                          },
                        })
                      }
                    >
                      Create bundle
                    </Button>
                  </InlineStack>
                </IndexTable.Cell>
              </IndexTable.Row>
            ))}
          </IndexTable>
        </Card>
      </BlockStack>
    </Page>
  );
}
