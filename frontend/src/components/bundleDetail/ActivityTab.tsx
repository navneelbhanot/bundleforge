/**
 * Bundle Detail · Activity log tab (M-174).
 *
 * Reads /api/v1/bundles/:id/activity (paginated). Each row shows
 * the action badge, summary, and a relative timestamp with the
 * absolute time on hover. Polaris Pagination drives the page
 * cursor.
 */
import { useCallback, useEffect, useState } from "react";
import {
  Badge,
  BlockStack,
  Box,
  Banner,
  Card,
  EmptyState,
  InlineStack,
  Pagination,
  Text,
} from "@shopify/polaris";

export interface ActivityRow {
  id: string;
  action: string;
  summary: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

interface ActivityResponse {
  data: ActivityRow[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

export interface ActivityTabProps {
  bundleId: string;
  /** DI seam for tests. Defaults to fetch(). */
  fetcher?: (path: string) => Promise<ActivityResponse>;
  pageSize?: number;
}

function defaultFetcher(path: string): Promise<ActivityResponse> {
  return fetch(path).then((r) => {
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json() as Promise<ActivityResponse>;
  });
}

const ACTION_TONE: Record<
  string,
  "success" | "info" | "warning" | "attention" | "critical"
> = {
  published: "success",
  archived: "warning",
  moved_to_draft: "attention",
  details_updated: "info",
  items_updated: "info",
  pricing_updated: "info",
  schedule_updated: "info",
  display_updated: "info",
  eligibility_updated: "info",
  inventory_rules_updated: "info",
  deleted: "critical",
};

function formatAction(action: string): string {
  return action.replace(/_/g, " ");
}

function formatRelative(iso: string): string {
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return iso;
  const diffMs = Date.now() - t;
  if (diffMs < 0) return new Date(iso).toLocaleString();
  const sec = Math.round(diffMs / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.round(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.round(hr / 24);
  if (day < 30) return `${day}d ago`;
  return new Date(iso).toLocaleDateString();
}

export function ActivityTab(props: ActivityTabProps): JSX.Element {
  const { bundleId, fetcher = defaultFetcher, pageSize = 20 } = props;
  const [page, setPage] = useState(1);
  const [data, setData] = useState<ActivityResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(
    (p: number) => {
      setLoading(true);
      setError(null);
      fetcher(
        `/api/v1/bundles/${bundleId}/activity?page=${p}&limit=${pageSize}`,
      )
        .then((r) => {
          setData(r);
          setLoading(false);
        })
        .catch((e: Error) => {
          setError(e.message);
          setLoading(false);
        });
    },
    [bundleId, fetcher, pageSize],
  );

  useEffect(() => {
    load(page);
  }, [load, page]);

  if (error) {
    return (
      <Banner tone="critical" title="Could not load activity">
        <p>{error}</p>
      </Banner>
    );
  }

  if (!data && loading) {
    return (
      <Card>
        <Text as="p" tone="subdued">
          Loading activity…
        </Text>
      </Card>
    );
  }

  const rows = data?.data ?? [];
  const pagination = data?.pagination;

  if (rows.length === 0) {
    return (
      <Card>
        <EmptyState heading="No activity yet" image="">
          <p>
            Actions appear here when you publish, archive, or save
            changes to this bundle. Activity is recorded
            automatically — there is nothing to configure.
          </p>
        </EmptyState>
      </Card>
    );
  }

  return (
    <BlockStack gap="400">
      <Text as="h2" variant="headingMd">
        Activity log
      </Text>
      <Card>
        <BlockStack gap="200">
          {rows.map((row) => (
            <Box
              key={row.id}
              background="bg-surface-secondary"
              padding="300"
              borderRadius="200"
            >
              <InlineStack align="space-between" blockAlign="center" gap="300">
                <BlockStack gap="050">
                  <InlineStack gap="200" blockAlign="center">
                    <Badge tone={ACTION_TONE[row.action] ?? "info"}>
                      {formatAction(row.action)}
                    </Badge>
                    <Text as="p" fontWeight="semibold">
                      {row.summary}
                    </Text>
                  </InlineStack>
                </BlockStack>
                <Text
                  as="p"
                  variant="bodySm"
                  tone="subdued"
                  // Native title surfaces the absolute timestamp on hover.
                >
                  <span title={new Date(row.createdAt).toLocaleString()}>
                    {formatRelative(row.createdAt)}
                  </span>
                </Text>
              </InlineStack>
            </Box>
          ))}
        </BlockStack>
      </Card>
      {pagination && (pagination.hasPrev || pagination.hasNext) && (
        <InlineStack align="center">
          <Pagination
            label={`Page ${pagination.page} of ${pagination.totalPages}`}
            hasPrevious={pagination.hasPrev}
            hasNext={pagination.hasNext}
            onPrevious={() => setPage((p) => Math.max(1, p - 1))}
            onNext={() => setPage((p) => p + 1)}
          />
        </InlineStack>
      )}
    </BlockStack>
  );
}
