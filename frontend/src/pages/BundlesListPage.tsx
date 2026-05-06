/**
 * Bundles list page (M-097, IndexFilters in M-176).
 *
 * Fetches /api/v1/bundles with filters. When there are bundles,
 * renders Polaris IndexFilters + IndexTable wrapped in
 * `BundlesListTable`. When there aren't, shows a "welcome to
 * BundleForge" landing.
 *
 * Saved views are persisted under `settings.savedViews` and
 * loaded once on mount. Saving/deleting a view PATCHes the
 * whole array back; the client owns ordering.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  BlockStack,
  Box,
  Button,
  Card,
  Frame,
  Grid,
  InlineStack,
  Page,
  Text,
  Toast,
} from "@shopify/polaris";

import {
  BundlesListTable,
  type BundleListFilters,
  type BundleRow,
  type BundleSort,
  type SavedView,
  type ViewMode,
} from "../components/bundlesList/BundlesListTable";
import {
  TemplatesModal,
  type BundleTemplate,
} from "../components/bundlesList/TemplatesModal";
import { OnboardingWizard } from "../components/OnboardingWizard";
import { PageLoading } from "../components/PageLoading";

const ONBOARDING_DISMISSED_KEY = "bundleforge:onboarding-dismissed";
const PAGE_SIZE = 20; // matches the API's natural page size

const DEFAULT_SORT: BundleSort = { sortBy: "createdAt", sortOrder: "desc" };
const DEFAULT_VIEW_MODE: ViewMode = "table";

const BUNDLE_TYPES = [
  "fixed",
  "mix_match",
  "bogo",
  "bxgy",
  "volume",
  "build_box",
  "multipack",
  "gift",
  "mystery",
  "sample",
  "subscription",
  "wholesale",
  "custom",
] as const;

function readDismissed(): boolean {
  try {
    return window.localStorage.getItem(ONBOARDING_DISMISSED_KEY) === "1";
  } catch {
    return false;
  }
}

function writeDismissed(): void {
  try {
    window.localStorage.setItem(ONBOARDING_DISMISSED_KEY, "1");
  } catch {
    // private mode / disabled — silently fall through; the wizard will
    // re-appear on next load, which is acceptable.
  }
}

interface DifferentiatorProps {
  title: string;
  body: string;
  accent: string;
}

function Differentiator({ title, body, accent }: DifferentiatorProps): JSX.Element {
  return (
    <Card>
      <BlockStack gap="200">
        <InlineStack gap="200" blockAlign="center">
          <span
            aria-hidden
            style={{
              display: "inline-block",
              width: 8,
              height: 8,
              borderRadius: 999,
              background: accent,
            }}
          />
          <Text as="h3" variant="headingSm">
            {title}
          </Text>
        </InlineStack>
        <Text as="p" tone="subdued">
          {body}
        </Text>
      </BlockStack>
    </Card>
  );
}

interface StatCardProps {
  label: string;
  value: string | number;
  tone?: "default" | "success" | "info" | "warning";
}

function StatCard({ label, value, tone = "default" }: StatCardProps): JSX.Element {
  const accent =
    tone === "success"
      ? "#1f7a3f"
      : tone === "warning"
        ? "#a66200"
        : tone === "info"
          ? "#1f5fa6"
          : "#1e293b";
  return (
    <Card>
      <BlockStack gap="100">
        <Text as="p" tone="subdued" variant="bodySm">
          {label}
        </Text>
        <Text as="p" variant="heading2xl">
          <span style={{ color: accent }}>{value}</span>
        </Text>
      </BlockStack>
    </Card>
  );
}

function FreshShopDashboard({
  onCreate,
  onTour,
  onBrowseTemplates,
  onDismiss,
}: {
  onCreate: () => void;
  onTour: () => void;
  onBrowseTemplates: () => void;
  onDismiss: () => void;
}): JSX.Element {
  return (
    <BlockStack gap="500">
      <Card>
        <Box
          padding="600"
          background="bg-surface-secondary"
          borderRadius="300"
        >
          <BlockStack gap="300">
            <Text as="h1" variant="heading2xl">
              No bundles yet — let's fix that.
            </Text>
            <Text as="p" tone="subdued">
              BundleForge runs the same pricing engine on the cart, the
              checkout, and the audit log so cents agree everywhere.
              Components decrement atomically. Every adjustment is
              recorded and immutable. You publish, customers buy,
              accounting ties out — that's the whole pitch.
            </Text>
            <InlineStack gap="200">
              <Button variant="primary" onClick={onCreate}>
                Create your first bundle
              </Button>
              <Button onClick={onBrowseTemplates}>Browse templates</Button>
              <Button onClick={onTour}>Take the 30-second tour</Button>
              <Button variant="tertiary" onClick={onDismiss}>
                I'll explore on my own
              </Button>
            </InlineStack>
          </BlockStack>
        </Box>
      </Card>

      <Grid>
        <Grid.Cell columnSpan={{ xs: 6, sm: 6, md: 4, lg: 4, xl: 4 }}>
          <Differentiator
            accent="#1f7a3f"
            title="Atomic inventory"
            body="Each bundle order decrements every component SKU in a single Postgres transaction. Partial updates are impossible by construction."
          />
        </Grid.Cell>
        <Grid.Cell columnSpan={{ xs: 6, sm: 6, md: 4, lg: 4, xl: 4 }}>
          <Differentiator
            accent="#1f5fa6"
            title="Pricing parity"
            body="The same pure pricing function runs server-side, in the cart, and in Shopify's Cart Transform Function. A test enforces cents-exact agreement on every commit."
          />
        </Grid.Cell>
        <Grid.Cell columnSpan={{ xs: 6, sm: 6, md: 4, lg: 4, xl: 4 }}>
          <Differentiator
            accent="#a66200"
            title="Immutable audit log"
            body="Every inventory event writes to inventory_audit_log. The table has a database-level trigger that rejects UPDATE — your reconciliation history can't drift."
          />
        </Grid.Cell>
      </Grid>

      <Card>
        <BlockStack gap="200">
          <Text as="h2" variant="headingMd">
            When you're ready
          </Text>
          <Text as="p" tone="subdued">
            BundleForge installs as a Theme App Extension on Online
            Store 2.0 themes. No Liquid edits. Five drop-in blocks
            (universal, mix-and-match, BOGO, build-a-box, variant
            selector) cover every bundle type.
          </Text>
        </BlockStack>
      </Card>
    </BlockStack>
  );
}

function buildQuery(
  filters: BundleListFilters,
  sort: BundleSort,
  page: number,
  limit: number,
): string {
  const params = new URLSearchParams();
  params.set("limit", String(limit));
  params.set("page", String(page));
  params.set("sortBy", sort.sortBy);
  params.set("sortOrder", sort.sortOrder);
  if (filters.status) params.set("status", filters.status);
  if (filters.type) params.set("type", filters.type);
  if (filters.search && filters.search.trim().length > 0) {
    params.set("search", filters.search.trim());
  }
  return params.toString();
}

interface BundlesPayload {
  data: BundleRow[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

interface SettingsPayload {
  savedViews?: SavedView[];
}

function genId(): string {
  // crypto.randomUUID is broadly available in jsdom + browsers; fall
  // back to a timestamp-based string if unavailable.
  try {
    return crypto.randomUUID();
  } catch {
    return `view-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }
}

export function BundlesListPage(): JSX.Element {
  const navigate = useNavigate();
  const [rows, setRows] = useState<BundleRow[] | null>(null);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [showWizard, setShowWizard] = useState(false);
  const [filters, setFilters] = useState<BundleListFilters>({});
  const [views, setViews] = useState<SavedView[]>([]);
  const [selectedViewIndex, setSelectedViewIndex] = useState(-1);
  const [hasEverHadBundles, setHasEverHadBundles] = useState(false);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [templates, setTemplates] = useState<BundleTemplate[]>([]);
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [instantiateBusy, setInstantiateBusy] = useState(false);
  const [sort, setSort] = useState<BundleSort>(DEFAULT_SORT);
  const [viewMode, setViewMode] = useState<ViewMode>(DEFAULT_VIEW_MODE);
  const [page, setPage] = useState(1);
  const [paginationInfo, setPaginationInfo] = useState({
    page: 1,
    totalPages: 1,
    hasPrev: false,
    hasNext: false,
  });
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchBundles = useCallback(
    async (
      nextFilters: BundleListFilters,
      nextSort: BundleSort,
      nextPage: number,
    ): Promise<void> => {
      try {
        const res = await fetch(
          `/api/v1/bundles?${buildQuery(nextFilters, nextSort, nextPage, PAGE_SIZE)}`,
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const body = (await res.json()) as BundlesPayload;
        setRows(body.data);
        setTotal(body.pagination?.total ?? body.data.length);
        setPaginationInfo({
          page: body.pagination?.page ?? nextPage,
          totalPages: body.pagination?.totalPages ?? 1,
          hasPrev: body.pagination?.hasPrev ?? false,
          hasNext: body.pagination?.hasNext ?? false,
        });
        if (body.data.length > 0 || (body.pagination?.total ?? 0) > 0) {
          setHasEverHadBundles(true);
        }
      } catch (e) {
        setError((e as Error).message);
      }
    },
    [],
  );

  // Initial load + debounced reload on (filters, sort, page) change.
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      void fetchBundles(filters, sort, page);
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [filters, sort, page, fetchBundles]);

  // Load saved views once on mount.
  useEffect(() => {
    fetch("/api/v1/settings")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((body: SettingsPayload) => setViews(body.savedViews ?? []))
      .catch(() => setViews([]));
  }, []);

  function handleDismiss(): void {
    writeDismissed();
    setShowWizard(false);
  }

  function handleComplete(): void {
    handleDismiss();
    navigate("/bundles/new");
  }

  const handleFilterChange = useCallback((next: BundleListFilters) => {
    // Editing filters drops you back into the All view + page 1.
    setSelectedViewIndex(-1);
    setFilters(next);
    setPage(1);
  }, []);

  const handleSortChange = useCallback((next: BundleSort) => {
    setSelectedViewIndex(-1);
    setSort(next);
    setPage(1);
  }, []);

  const handleViewModeChange = useCallback((next: ViewMode) => {
    setSelectedViewIndex(-1);
    setViewMode(next);
  }, []);

  const handlePageChange = useCallback((next: number) => {
    setPage(Math.max(1, next));
  }, []);

  const handleViewSelect = useCallback(
    (index: number) => {
      setSelectedViewIndex(index);
      setPage(1);
      if (index < 0) {
        setFilters({});
        setSort(DEFAULT_SORT);
        setViewMode(DEFAULT_VIEW_MODE);
      } else {
        const view = views[index];
        if (view) {
          setFilters(view.filters ?? {});
          setSort(view.sort ?? DEFAULT_SORT);
          setViewMode(view.viewMode ?? DEFAULT_VIEW_MODE);
        }
      }
    },
    [views],
  );

  const persistViews = useCallback(
    async (next: SavedView[]): Promise<void> => {
      const res = await fetch("/api/v1/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ savedViews: next }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = (await res.json()) as SettingsPayload;
      setViews(body.savedViews ?? next);
    },
    [],
  );

  const handleSaveView = useCallback(
    async (label: string): Promise<void> => {
      const view: SavedView = {
        id: genId(),
        label,
        filters: { ...filters },
        sort: { ...sort },
        viewMode,
      };
      const next = [...views, view];
      await persistViews(next);
      // Auto-select the newly saved view.
      setSelectedViewIndex(next.length - 1);
    },
    [filters, sort, viewMode, views, persistViews],
  );

  const handleDeleteView = useCallback(
    async (id: string): Promise<void> => {
      const next = views.filter((v) => v.id !== id);
      await persistViews(next);
      setSelectedViewIndex(-1);
      setFilters({});
      setSort(DEFAULT_SORT);
      setViewMode(DEFAULT_VIEW_MODE);
      setPage(1);
    },
    [views, persistViews],
  );

  const runBulk = useCallback(
    async (
      path: "publish" | "archive" | "delete",
      ids: string[],
    ): Promise<void> => {
      if (ids.length === 0) return;
      setBulkBusy(true);
      try {
        const res = await fetch(`/api/v1/bundles/bulk/${path}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ids }),
        });
        if (res.status === 400 || res.status === 401) {
          throw new Error(`HTTP ${res.status}`);
        }
        const body = (await res.json()) as {
          succeeded: string[];
          failed: Array<{ id: string; reason: string }>;
        };
        const verb = path === "publish" ? "Published" : path === "archive" ? "Archived" : "Deleted";
        if (body.failed.length === 0) {
          setToast(
            `${verb} ${body.succeeded.length} bundle${body.succeeded.length === 1 ? "" : "s"}.`,
          );
        } else if (body.succeeded.length === 0) {
          setToast(`${verb}: 0 succeeded, ${body.failed.length} failed.`);
        } else {
          setToast(
            `${verb} ${body.succeeded.length}, ${body.failed.length} failed.`,
          );
        }
        await fetchBundles(filters, sort, page);
      } catch (e) {
        setToast(`Bulk ${path} failed: ${(e as Error).message}`);
      } finally {
        setBulkBusy(false);
      }
    },
    [fetchBundles, filters, sort, page],
  );

  const handleBulkPublish = useCallback(
    (ids: string[]) => runBulk("publish", ids),
    [runBulk],
  );
  const handleBulkArchive = useCallback(
    (ids: string[]) => runBulk("archive", ids),
    [runBulk],
  );
  const handleBulkDelete = useCallback(
    (ids: string[]) => runBulk("delete", ids),
    [runBulk],
  );

  // Lazy-load templates the first time the merchant opens
  // the modal. They're a small static list so one fetch
  // per page-load is fine; we don't bother to refresh.
  const openTemplates = useCallback(async (): Promise<void> => {
    setTemplatesOpen(true);
    if (templates.length > 0) return;
    try {
      const res = await fetch("/api/v1/bundles/templates");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = (await res.json()) as { data: BundleTemplate[] };
      setTemplates(body.data);
    } catch (e) {
      setToast(`Could not load templates: ${(e as Error).message}`);
    }
  }, [templates.length]);

  const handleUseTemplate = useCallback(
    async (templateId: string): Promise<void> => {
      setInstantiateBusy(true);
      try {
        const res = await fetch(
          `/api/v1/bundles/templates/${templateId}/instantiate`,
          { method: "POST" },
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const body = (await res.json()) as { id: string };
        setTemplatesOpen(false);
        navigate(`/bundles/${body.id}#setup`);
      } catch (e) {
        setToast(`Couldn't create from template: ${(e as Error).message}`);
      } finally {
        setInstantiateBusy(false);
      }
    },
    [navigate],
  );

  if (error && rows === null) {
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
    return <PageLoading title="Bundles" variant="stats" />;
  }

  // Fresh shop and merchant clicked "Take the tour".
  if (showWizard) {
    return (
      <Page title="Bundles">
        <OnboardingWizard
          onComplete={handleComplete}
          onDismiss={() => setShowWizard(false)}
        />
      </Page>
    );
  }

  // Fresh shop: show the welcome only when the shop *has never*
  // had bundles. Once filters narrow the list to zero, we keep
  // the IndexFilters chrome so the merchant can clear filters.
  const filtersActive =
    Boolean(filters.status) ||
    Boolean(filters.type) ||
    Boolean(filters.search && filters.search.trim().length > 0);
  if (rows.length === 0 && total === 0 && !hasEverHadBundles && !filtersActive) {
    return (
      <Frame>
        <Page title="Bundles">
          <FreshShopDashboard
            onCreate={() => navigate("/bundles/new")}
            onTour={() => setShowWizard(true)}
            onBrowseTemplates={openTemplates}
            onDismiss={handleDismiss}
          />
        </Page>
        <TemplatesModal
          open={templatesOpen}
          templates={templates}
          busy={instantiateBusy}
          onUseTemplate={handleUseTemplate}
          onClose={() => setTemplatesOpen(false)}
        />
      </Frame>
    );
  }

  // Stats reflect the *current filtered* result set so the strip
  // matches what the merchant is looking at. Total counts
  // unfiltered totals stay accessible via the "Showing first N of
  // M" footer rendered inside BundlesListTable.
  const active = rows.filter((b) => b.status === "active").length;
  const draft = rows.filter((b) => b.status === "draft").length;
  const archived = rows.filter((b) => b.status === "archived").length;

  return (
    <Frame>
      <Page
        title="Bundles"
        primaryAction={{ content: "Create bundle", url: "/bundles/new" }}
        secondaryActions={[
          { content: "Browse templates", onAction: openTemplates },
        ]}
      >
        <BlockStack gap="500">
          <Grid>
            <Grid.Cell columnSpan={{ xs: 6, sm: 3, md: 3, lg: 3, xl: 3 }}>
              <StatCard label={filtersActive ? "Filtered" : "Total"} value={rows.length} />
            </Grid.Cell>
            <Grid.Cell columnSpan={{ xs: 6, sm: 3, md: 3, lg: 3, xl: 3 }}>
              <StatCard label="Active" value={active} tone="success" />
            </Grid.Cell>
            <Grid.Cell columnSpan={{ xs: 6, sm: 3, md: 3, lg: 3, xl: 3 }}>
              <StatCard label="Draft" value={draft} tone="info" />
            </Grid.Cell>
            <Grid.Cell columnSpan={{ xs: 6, sm: 3, md: 3, lg: 3, xl: 3 }}>
              <StatCard
                label="Archived"
                value={archived}
                tone={archived > 0 ? "warning" : "default"}
              />
            </Grid.Cell>
          </Grid>

          <Card>
            <BundlesListTable
              rows={rows}
              total={total}
              views={views}
              selectedViewIndex={selectedViewIndex}
              filters={filters}
              bundleTypes={BUNDLE_TYPES}
              sort={sort}
              viewMode={viewMode}
              pagination={paginationInfo}
              onFilterChange={handleFilterChange}
              onSortChange={handleSortChange}
              onViewModeChange={handleViewModeChange}
              onPageChange={handlePageChange}
              onViewSelect={handleViewSelect}
              onSaveView={handleSaveView}
              onDeleteView={handleDeleteView}
              onRowClick={(id) => navigate(`/bundles/${id}`)}
              onBulkPublish={handleBulkPublish}
              onBulkArchive={handleBulkArchive}
              onBulkDelete={handleBulkDelete}
              bulkBusy={bulkBusy}
            />
          </Card>
        </BlockStack>
      </Page>
      {toast && <Toast content={toast} onDismiss={() => setToast(null)} />}
      <TemplatesModal
        open={templatesOpen}
        templates={templates}
        busy={instantiateBusy}
        onUseTemplate={handleUseTemplate}
        onClose={() => setTemplatesOpen(false)}
      />
    </Frame>
  );
}
