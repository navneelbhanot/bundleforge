/**
 * Dashboard widgets (M-184).
 *
 * Each widget is a self-contained Polaris Card that owns its own
 * fetch, loading, empty, and error state. One widget failing
 * never blocks the others. The page composes them in a Grid.
 *
 * Each widget exports a stable testid via the wrapper element so
 * a future visual-regression layer can pin layouts.
 */
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import {
  Badge,
  BlockStack,
  Box,
  Button,
  Card,
  InlineStack,
  Spinner,
  Text,
} from "@shopify/polaris";

// =============================================================================
// Shared helpers
// =============================================================================

interface WidgetState<T> {
  data: T | null;
  error: string | null;
}

function useFetch<T>(url: string): WidgetState<T> & { loading: boolean } {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    fetch(url)
      .then((r) =>
        r.ok ? (r.json() as Promise<T>) : Promise.reject(new Error(`HTTP ${r.status}`)),
      )
      .then((j) => {
        if (!cancelled) setData(j);
      })
      .catch((e: Error) => {
        if (!cancelled) setError(e.message);
      });
    return () => {
      cancelled = true;
    };
  }, [url]);
  return { data, error, loading: data === null && error === null };
}

function ViewAllButton({ url, label }: { url: string; label?: string }): JSX.Element {
  return (
    <Box paddingBlockStart="200">
      <Button url={url} variant="plain">
        {label ?? "View all →"}
      </Button>
    </Box>
  );
}

function WidgetCard({
  title,
  loading,
  error,
  empty,
  children,
}: {
  title: string;
  loading: boolean;
  error: string | null;
  empty?: boolean;
  children: React.ReactNode;
}): JSX.Element {
  const { t } = useTranslation();
  return (
    <Card>
      <BlockStack gap="200">
        <Text as="h3" variant="headingSm">
          {title}
        </Text>
        {loading ? (
          <InlineStack gap="200" blockAlign="center">
            <Spinner accessibilityLabel={t("dashboard.widgets.loading")} size="small" />
            <Text as="p" tone="subdued">
              {t("dashboard.widgets.loading")}
            </Text>
          </InlineStack>
        ) : error ? (
          <Text as="p" tone="critical">
            {t("dashboard.widgets.couldntLoad", { message: error })}
          </Text>
        ) : empty ? (
          <Text as="p" tone="subdued">
            {t("dashboard.widgets.nothingYet")}
          </Text>
        ) : (
          children
        )}
      </BlockStack>
    </Card>
  );
}

function fmtMoney(n: unknown): string {
  return typeof n === "number" && Number.isFinite(n) ? n.toFixed(2) : "0.00";
}

function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const diff = Date.now() - then;
  const min = Math.round(diff / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.round(hr / 24);
  return `${day}d ago`;
}

// =============================================================================
// Widget 1 — Revenue snapshot
// =============================================================================

interface AnalyticsOverview {
  totalRevenue: number;
  totalOrders: number;
  topBundles: Array<{ bundleId: string; revenue: number; orders: number }>;
}

export function RevenueSnapshotWidget(): JSX.Element {
  const { t } = useTranslation();
  const { data, error, loading } = useFetch<AnalyticsOverview>(
    "/api/v1/analytics/overview",
  );
  return (
    <WidgetCard
      title={t("dashboard.widgets.revenueSnapshot")}
      loading={loading}
      error={error}
    >
      {data ? (
        <BlockStack gap="300">
          <InlineStack gap="600">
            <BlockStack gap="050">
              <Text as="p" tone="subdued" variant="bodySm">
                Total revenue
              </Text>
              <Text as="p" variant="heading2xl">
                ${fmtMoney(data.totalRevenue)}
              </Text>
            </BlockStack>
            <BlockStack gap="050">
              <Text as="p" tone="subdued" variant="bodySm">
                Total orders
              </Text>
              <Text as="p" variant="heading2xl">
                {data.totalOrders}
              </Text>
            </BlockStack>
            <BlockStack gap="050">
              <Text as="p" tone="subdued" variant="bodySm">
                Top bundle
              </Text>
              <Text as="p" variant="headingMd">
                {data.topBundles[0]?.bundleId ?? "—"}
              </Text>
            </BlockStack>
          </InlineStack>
          <ViewAllButton url="/analytics" label="View analytics →" />
        </BlockStack>
      ) : null}
    </WidgetCard>
  );
}

// =============================================================================
// Widget 2 — Recent bundles
// =============================================================================

interface BundleRow {
  id: string;
  title: string;
  status: string;
  type: string;
  updatedAt: string;
}

interface BundlesListResp {
  data: BundleRow[];
  pagination: { total: number };
}

export function RecentBundlesWidget(): JSX.Element {
  const { t } = useTranslation();
  const { data, error, loading } = useFetch<BundlesListResp>(
    "/api/v1/bundles?sortBy=updatedAt&sortOrder=desc&limit=5",
  );
  return (
    <WidgetCard
      title={t("dashboard.widgets.recentBundles")}
      loading={loading}
      error={error}
      empty={data?.data.length === 0}
    >
      {data && data.data.length > 0 ? (
        <BlockStack gap="200">
          {data.data.slice(0, 5).map((b) => (
            <InlineStack key={b.id} align="space-between" blockAlign="center">
              <Button url={`/bundles/${b.id}`} variant="plain">
                {b.title}
              </Button>
              <Badge
                tone={
                  b.status === "active"
                    ? "success"
                    : b.status === "archived"
                      ? "warning"
                      : "info"
                }
              >
                {b.status}
              </Badge>
            </InlineStack>
          ))}
          <ViewAllButton url="/bundles" />
        </BlockStack>
      ) : null}
    </WidgetCard>
  );
}

// =============================================================================
// Widget 3 — Bundles overview (counts)
// =============================================================================

export function BundleCountsWidget(): JSX.Element {
  const { t } = useTranslation();
  const { data, error, loading } = useFetch<BundlesListResp>(
    "/api/v1/bundles?limit=100",
  );
  const active = data?.data.filter((b) => b.status === "active").length ?? 0;
  const draft = data?.data.filter((b) => b.status === "draft").length ?? 0;
  const archived = data?.data.filter((b) => b.status === "archived").length ?? 0;
  return (
    <WidgetCard
      title={t("dashboard.widgets.bundleStatus")}
      loading={loading}
      error={error}
    >
      {data ? (
        <BlockStack gap="200">
          <InlineStack gap="600">
            <BlockStack gap="050">
              <Text as="p" tone="subdued" variant="bodySm">
                Active
              </Text>
              <Text as="p" variant="headingLg">
                {active}
              </Text>
            </BlockStack>
            <BlockStack gap="050">
              <Text as="p" tone="subdued" variant="bodySm">
                Draft
              </Text>
              <Text as="p" variant="headingLg">
                {draft}
              </Text>
            </BlockStack>
            <BlockStack gap="050">
              <Text as="p" tone="subdued" variant="bodySm">
                Archived
              </Text>
              <Text as="p" variant="headingLg">
                {archived}
              </Text>
            </BlockStack>
          </InlineStack>
          <ViewAllButton url="/bundles" />
        </BlockStack>
      ) : null}
    </WidgetCard>
  );
}

// =============================================================================
// Widget 4 — Inventory health
// =============================================================================

interface InventoryHealth {
  shopId: string;
  counts: { synced: number; pending: number; error: number; locked: number };
}

export function InventoryHealthWidget(): JSX.Element {
  const { t } = useTranslation();
  const { data, error, loading } = useFetch<InventoryHealth>(
    "/api/v1/inventory/health",
  );
  return (
    <WidgetCard
      title={t("dashboard.widgets.inventoryHealth")}
      loading={loading}
      error={error}
    >
      {data ? (
        <BlockStack gap="200">
          <InlineStack gap="600">
            <BlockStack gap="050">
              <Text as="p" tone="subdued" variant="bodySm">
                Synced
              </Text>
              <Text as="p" variant="headingLg">
                {data.counts.synced}
              </Text>
            </BlockStack>
            <BlockStack gap="050">
              <Text as="p" tone="subdued" variant="bodySm">
                Pending
              </Text>
              <Text as="p" variant="headingLg">
                {data.counts.pending}
              </Text>
            </BlockStack>
            <BlockStack gap="050">
              <Text as="p" tone="subdued" variant="bodySm">
                Error
              </Text>
              <Text as="p" variant="headingLg">
                {data.counts.error}
              </Text>
            </BlockStack>
            <BlockStack gap="050">
              <Text as="p" tone="subdued" variant="bodySm">
                Locked
              </Text>
              <Text as="p" variant="headingLg">
                {data.counts.locked}
              </Text>
            </BlockStack>
          </InlineStack>
          <ViewAllButton url="/inventory" />
        </BlockStack>
      ) : null}
    </WidgetCard>
  );
}

// =============================================================================
// Widget 5 — Recent orders
// =============================================================================

interface OrderRow {
  id: string;
  shopifyOrderNumber: string;
  status: string;
  bundlePrice: string;
  currency: string;
  createdAt: string;
}

interface OrdersResp {
  data: OrderRow[];
}

export function RecentOrdersWidget(): JSX.Element {
  const { t } = useTranslation();
  const { data, error, loading } = useFetch<OrdersResp>(
    "/api/v1/orders?limit=5",
  );
  const rows = Array.isArray(data) ? (data as unknown as OrderRow[]) : data?.data;
  const list = rows ?? [];
  return (
    <WidgetCard
      title={t("dashboard.widgets.recentOrders")}
      loading={loading}
      error={error}
      empty={list.length === 0}
    >
      {list.length > 0 ? (
        <BlockStack gap="200">
          {list.slice(0, 5).map((o) => (
            <InlineStack
              key={o.id}
              align="space-between"
              blockAlign="center"
            >
              <Button url={`/orders/${o.id}`} variant="plain">
                #{o.shopifyOrderNumber}
              </Button>
              <Text as="span">
                {o.currency} {o.bundlePrice}
              </Text>
            </InlineStack>
          ))}
          <ViewAllButton url="/orders" />
        </BlockStack>
      ) : null}
    </WidgetCard>
  );
}

// =============================================================================
// Widget 6 — Pending AI suggestions
// =============================================================================

interface AiPair {
  skuA: string;
  skuB: string;
  count: number;
  support: number;
  lift: number;
}

interface AiResp {
  pairs: AiPair[];
  totalBaskets: number;
  reason?: string;
}

export function AiSuggestionsWidget(): JSX.Element {
  const { t } = useTranslation();
  const { data, error, loading } = useFetch<AiResp>(
    "/api/v1/ai/suggested-bundles?topN=3",
  );
  return (
    <WidgetCard
      title={t("dashboard.widgets.aiSuggestions")}
      loading={loading}
      error={error}
      empty={data?.pairs.length === 0}
    >
      {data && data.pairs.length > 0 ? (
        <BlockStack gap="200">
          {data.pairs.slice(0, 3).map((p) => (
            <InlineStack
              key={`${p.skuA}-${p.skuB}`}
              align="space-between"
              blockAlign="center"
            >
              <Text as="span">
                {p.skuA} + {p.skuB}
              </Text>
              <Badge
                tone={p.lift >= 3 ? "success" : p.lift >= 1.5 ? "info" : "attention"}
              >
                {`${p.lift.toFixed(1)}× lift`}
              </Badge>
            </InlineStack>
          ))}
          <ViewAllButton url="/ai-suggestions" />
        </BlockStack>
      ) : null}
    </WidgetCard>
  );
}

// =============================================================================
// Widget 7 — Recent activity (shop-wide)
// =============================================================================

interface ActivityRow {
  id: string;
  bundleId: string;
  bundleTitle: string | null;
  action: string;
  summary: string;
  createdAt: string;
}

interface ActivityResp {
  data: ActivityRow[];
}

export function RecentActivityWidget(): JSX.Element {
  const { t } = useTranslation();
  const { data, error, loading } = useFetch<ActivityResp>(
    "/api/v1/activity?limit=5",
  );
  return (
    <WidgetCard
      title={t("dashboard.widgets.recentActivity")}
      loading={loading}
      error={error}
      empty={data?.data.length === 0}
    >
      {data && data.data.length > 0 ? (
        <BlockStack gap="200">
          {data.data.slice(0, 5).map((a) => (
            <InlineStack
              key={a.id}
              align="space-between"
              blockAlign="center"
            >
              <Button url={`/bundles/${a.bundleId}`} variant="plain">
                {a.bundleTitle ?? a.bundleId.slice(0, 8)}
              </Button>
              <InlineStack gap="200">
                <Text as="span" tone="subdued">
                  {a.action.replace(/_/g, " ")}
                </Text>
                <Text as="span" tone="subdued" variant="bodySm">
                  {relativeTime(a.createdAt)}
                </Text>
              </InlineStack>
            </InlineStack>
          ))}
        </BlockStack>
      ) : null}
    </WidgetCard>
  );
}
