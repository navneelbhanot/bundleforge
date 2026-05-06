/**
 * Bundle Detail · Performance tab (M-174).
 *
 * Reads the analytics aggregate at /api/v1/analytics/bundles/:id
 * (M-112) and renders a KPI strip with the funnel + revenue.
 * Date-range filters and per-day series land when the shop-level
 * Analytics page gets the same treatment.
 */
import { useEffect, useState } from "react";
import {
  Banner,
  BlockStack,
  Box,
  Card,
  EmptyState,
  InlineGrid,
  InlineStack,
  Text,
} from "@shopify/polaris";

interface AnalyticsGroup {
  eventType: string;
  count: number;
  revenue: number;
}

interface AnalyticsResponse {
  bundleId: string;
  groups: AnalyticsGroup[];
}

export interface PerformanceTabProps {
  bundleId: string;
  /** DI seam for tests. Defaults to fetch(). */
  fetcher?: (path: string) => Promise<AnalyticsResponse>;
}

function defaultFetcher(path: string): Promise<AnalyticsResponse> {
  return fetch(path).then((r) => {
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json() as Promise<AnalyticsResponse>;
  });
}

function fmtMoney(n: number): string {
  return Number.isFinite(n) ? n.toFixed(2) : "0.00";
}

function pct(num: number, denom: number): string {
  if (!Number.isFinite(num) || !Number.isFinite(denom) || denom === 0) {
    return "—";
  }
  return `${((num / denom) * 100).toFixed(1)}%`;
}

interface KpiTileProps {
  label: string;
  value: string;
  hint?: string;
}

function KpiTile({ label, value, hint }: KpiTileProps): JSX.Element {
  return (
    <Card>
      <BlockStack gap="100">
        <Text as="p" variant="bodySm" tone="subdued">
          {label}
        </Text>
        <Text as="p" variant="heading2xl">
          {value}
        </Text>
        {hint && (
          <Text as="p" variant="bodySm" tone="subdued">
            {hint}
          </Text>
        )}
      </BlockStack>
    </Card>
  );
}

export function PerformanceTab(props: PerformanceTabProps): JSX.Element {
  const { bundleId, fetcher = defaultFetcher } = props;
  const [data, setData] = useState<AnalyticsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setData(null);
    setError(null);
    fetcher(`/api/v1/analytics/bundles/${bundleId}`)
      .then(setData)
      .catch((e: Error) => setError(e.message));
  }, [bundleId, fetcher]);

  if (error) {
    return (
      <Banner tone="critical" title="Could not load performance">
        <p>{error}</p>
      </Banner>
    );
  }

  if (!data) {
    return (
      <Card>
        <Text as="p" tone="subdued">
          Loading performance…
        </Text>
      </Card>
    );
  }

  const groups = Array.isArray(data.groups) ? data.groups : [];
  const byType = new Map<string, { count: number; revenue: number }>();
  for (const g of groups) {
    byType.set(g.eventType, {
      count: typeof g.count === "number" ? g.count : 0,
      revenue: typeof g.revenue === "number" ? g.revenue : 0,
    });
  }

  const views = byType.get("view")?.count ?? 0;
  const addToCart = byType.get("add_to_cart")?.count ?? 0;
  const purchases = byType.get("purchase")?.count ?? 0;
  const revenue = byType.get("purchase")?.revenue ?? 0;

  const total = views + addToCart + purchases;
  if (total === 0) {
    return (
      <Card>
        <EmptyState
          heading="No performance data yet"
          image=""
        >
          <p>
            Views, add-to-cart, and purchase counts appear here once
            the storefront emits the first events for this bundle.
            Until then, this tab is intentionally blank.
          </p>
        </EmptyState>
      </Card>
    );
  }

  return (
    <BlockStack gap="400">
      <Text as="h2" variant="headingMd">
        Funnel &amp; revenue
      </Text>
      <InlineGrid columns={{ xs: 2, md: 4 }} gap="400">
        <KpiTile label="Views" value={String(views)} />
        <KpiTile label="Add to cart" value={String(addToCart)} />
        <KpiTile label="Purchases" value={String(purchases)} />
        <KpiTile label="Revenue" value={`$${fmtMoney(revenue)}`} />
      </InlineGrid>
      <InlineGrid columns={{ xs: 1, md: 2 }} gap="400">
        <KpiTile
          label="Conversion rate"
          value={pct(purchases, views)}
          hint="purchases / views"
        />
        <KpiTile
          label="Average order value"
          value={
            purchases > 0 ? `$${fmtMoney(revenue / purchases)}` : "—"
          }
          hint="revenue / purchases"
        />
      </InlineGrid>
      <Card>
        <BlockStack gap="200">
          <Text as="h3" variant="headingSm">
            Event breakdown
          </Text>
          {groups.length === 0 ? (
            <Text as="p" tone="subdued">
              No events recorded yet.
            </Text>
          ) : (
            groups.map((g) => (
              <Box key={g.eventType}>
                <InlineStack align="space-between">
                  <Text as="p">{g.eventType}</Text>
                  <Text as="p" tone="subdued">
                    {g.count} · ${fmtMoney(g.revenue)}
                  </Text>
                </InlineStack>
              </Box>
            ))
          )}
        </BlockStack>
      </Card>
    </BlockStack>
  );
}
