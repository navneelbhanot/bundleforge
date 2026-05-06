/**
 * Bundle list table with Polaris IndexFilters (M-176).
 *
 * Replaces the bare IndexTable with:
 *  - search input (debounced upstream)
 *  - status + type filter chips
 *  - saved-view tabs (persisted to settings.savedViews)
 *  - Save view / Delete view actions
 *
 * Props are pure controlled state — the page owns fetching and
 * persistence. This component is the lowest-level UI surface,
 * easy to render-test in isolation.
 */
import { useCallback, useState } from "react";
import {
  Badge,
  BlockStack,
  Box,
  Button,
  ButtonGroup,
  Card,
  ChoiceList,
  Grid,
  IndexFilters,
  IndexTable,
  IndexTableSelectionType,
  InlineStack,
  Modal,
  Pagination,
  TextField,
  Text,
  useIndexResourceState,
  useSetIndexFiltersMode,
} from "@shopify/polaris";

import { ConfirmDialog } from "../shell/ConfirmDialog";

export type BundleStatusFilter = "draft" | "active" | "archived";

export interface BundleListFilters {
  status?: BundleStatusFilter;
  type?: string;
  search?: string;
}

export interface BundleSort {
  sortBy: "createdAt" | "updatedAt" | "title" | "priority";
  sortOrder: "asc" | "desc";
}

export type ViewMode = "table" | "compact" | "card";

export interface SavedView {
  id: string;
  label: string;
  filters?: BundleListFilters;
  sort?: BundleSort;
  viewMode?: ViewMode;
}

export interface BundleRow {
  id: string;
  title: string;
  type: string;
  status: string;
  slug: string;
}

export interface PaginationInfo {
  page: number;
  totalPages: number;
  hasPrev: boolean;
  hasNext: boolean;
}

export interface BundlesListTableProps {
  rows: BundleRow[];
  /** Total count from the server (may exceed rows.length when paginated). */
  total: number;
  views: SavedView[];
  /** -1 means the built-in All view (no saved filter applied). */
  selectedViewIndex: number;
  filters: BundleListFilters;
  bundleTypes: readonly string[];
  /** Current sort. Defaults to createdAt desc when omitted. */
  sort: BundleSort;
  /** Current view mode. Defaults to "table". */
  viewMode: ViewMode;
  /** Server-driven pagination state. */
  pagination: PaginationInfo;
  onFilterChange: (next: BundleListFilters) => void;
  onSortChange: (next: BundleSort) => void;
  onViewModeChange: (next: ViewMode) => void;
  onPageChange: (next: number) => void;
  onViewSelect: (index: number) => void;
  onSaveView: (label: string) => Promise<void>;
  onDeleteView: (id: string) => Promise<void>;
  onRowClick: (id: string) => void;
  /** Bulk publish: called with the selected ids. */
  onBulkPublish?: (ids: string[]) => Promise<void>;
  /** Bulk archive: called with the selected ids. */
  onBulkArchive?: (ids: string[]) => Promise<void>;
  /** Bulk delete (soft): called with the selected ids. */
  onBulkDelete?: (ids: string[]) => Promise<void>;
  /** Disable bulk action buttons (in flight). */
  bulkBusy?: boolean;
}

const STATUS_CHOICES: Array<{ label: string; value: BundleStatusFilter }> = [
  { label: "Draft", value: "draft" },
  { label: "Active", value: "active" },
  { label: "Archived", value: "archived" },
];

interface SortOption {
  // Polaris's SortButtonChoice requires a `${string} asc | ${string} desc`
  // template-literal type for `value`. We mirror that here.
  key: `${string} asc` | `${string} desc`;
  label: string;
  sort: BundleSort;
}

const SORT_OPTIONS: SortOption[] = [
  {
    key: "createdAt desc",
    label: "Newest first",
    sort: { sortBy: "createdAt", sortOrder: "desc" },
  },
  {
    key: "createdAt asc",
    label: "Oldest first",
    sort: { sortBy: "createdAt", sortOrder: "asc" },
  },
  {
    key: "updatedAt desc",
    label: "Recently updated",
    sort: { sortBy: "updatedAt", sortOrder: "desc" },
  },
  {
    key: "title asc",
    label: "Title A → Z",
    sort: { sortBy: "title", sortOrder: "asc" },
  },
  {
    key: "title desc",
    label: "Title Z → A",
    sort: { sortBy: "title", sortOrder: "desc" },
  },
  {
    key: "priority desc",
    label: "Priority high → low",
    sort: { sortBy: "priority", sortOrder: "desc" },
  },
];

function sortKey(
  s: BundleSort,
): `${string} asc` | `${string} desc` {
  return s.sortOrder === "asc"
    ? (`${s.sortBy} asc` as const)
    : (`${s.sortBy} desc` as const);
}

type SelectionChangeFn = ReturnType<
  typeof useIndexResourceState
>["handleSelectionChange"];

interface BundleCardGridProps {
  rows: BundleRow[];
  selectedResources: string[];
  onSelectionChange: SelectionChangeFn;
  onRowClick: (id: string) => void;
  onBulkPublish?: (ids: string[]) => Promise<void>;
  onBulkArchive: () => void;
  onBulkDelete: () => void;
  bulkBusy: boolean;
}

function BundleCardGrid({
  rows,
  selectedResources,
  onSelectionChange,
  onRowClick,
  onBulkPublish,
  onBulkArchive,
  onBulkDelete,
  bulkBusy,
}: BundleCardGridProps): JSX.Element {
  const allSelected =
    rows.length > 0 && selectedResources.length === rows.length;
  return (
    <BlockStack gap="300">
      {selectedResources.length > 0 && (
        <Box
          padding="300"
          background="bg-surface-secondary"
          borderRadius="200"
        >
          <InlineStack align="space-between" blockAlign="center">
            <Text as="p" variant="bodyMd">
              {selectedResources.length} selected
            </Text>
            <ButtonGroup>
              {onBulkPublish && (
                <Button
                  disabled={bulkBusy}
                  onClick={() => onBulkPublish(selectedResources)}
                >
                  Publish
                </Button>
              )}
              <Button disabled={bulkBusy} onClick={onBulkArchive}>
                Archive
              </Button>
              <Button
                tone="critical"
                disabled={bulkBusy}
                onClick={onBulkDelete}
              >
                Delete
              </Button>
            </ButtonGroup>
          </InlineStack>
        </Box>
      )}
      {rows.length > 0 && (
        <InlineStack align="end">
          <Button
            variant="tertiary"
            onClick={() =>
              onSelectionChange(IndexTableSelectionType.All, !allSelected)
            }
          >
            {allSelected ? "Deselect all" : "Select all"}
          </Button>
        </InlineStack>
      )}
      <Grid>
        {rows.map((b) => {
          const selected = selectedResources.includes(b.id);
          return (
            <Grid.Cell
              key={b.id}
              columnSpan={{ xs: 6, sm: 6, md: 4, lg: 3, xl: 3 }}
            >
              <Card>
                <BlockStack gap="200">
                  <InlineStack align="space-between" blockAlign="center">
                    <input
                      type="checkbox"
                      aria-label={`Select ${b.title}`}
                      checked={selected}
                      onChange={() =>
                        onSelectionChange(
                          IndexTableSelectionType.Single,
                          !selected,
                          b.id,
                        )
                      }
                    />
                    <Badge
                      tone={b.status === "active" ? "success" : "info"}
                    >
                      {b.status}
                    </Badge>
                  </InlineStack>
                  <Text as="h3" variant="headingSm">
                    {b.title}
                  </Text>
                  <Text as="p" tone="subdued" variant="bodySm">
                    {b.type}
                  </Text>
                  <InlineStack align="end">
                    <Button onClick={() => onRowClick(b.id)} variant="tertiary">
                      Edit
                    </Button>
                  </InlineStack>
                </BlockStack>
              </Card>
            </Grid.Cell>
          );
        })}
      </Grid>
    </BlockStack>
  );
}

function statusLabel(s: BundleStatusFilter | undefined): string | null {
  if (!s) return null;
  const opt = STATUS_CHOICES.find((o) => o.value === s);
  return opt ? opt.label : s;
}

export function BundlesListTable(props: BundlesListTableProps): JSX.Element {
  const {
    rows,
    total,
    views,
    selectedViewIndex,
    filters,
    bundleTypes,
    sort,
    viewMode,
    pagination,
    onFilterChange,
    onSortChange,
    onViewModeChange,
    onPageChange,
    onViewSelect,
    onSaveView,
    onDeleteView,
    onRowClick,
    onBulkPublish,
    onBulkArchive,
    onBulkDelete,
    bulkBusy = false,
  } = props;

  const { mode, setMode } = useSetIndexFiltersMode();
  const [savingLabel, setSavingLabel] = useState("");
  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [saveBusy, setSaveBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<SavedView | null>(null);
  const [bulkConfirm, setBulkConfirm] = useState<
    null | "archive" | "delete"
  >(null);

  // Polaris's resource-state hook tracks selection.
  const {
    selectedResources,
    allResourcesSelected,
    handleSelectionChange,
    clearSelection,
  } = useIndexResourceState(
    rows as unknown as Array<{ [key: string]: unknown; id: string }>,
  );

  // Polaris IndexFilters tabs prop. First tab is the built-in All;
  // selectedViewIndex of -1 maps to tab 0.
  const tabs = [
    {
      id: "all",
      content: "All",
      onAction: () => onViewSelect(-1),
    },
    ...views.map((v, i) => ({
      id: v.id,
      content: v.label,
      onAction: () => onViewSelect(i),
      actions: [
        {
          type: "delete" as const,
          onAction: () => setConfirmDelete(v),
              onPrimaryAction: async (): Promise<boolean> => {
                await onDeleteView(v.id);
                return true;
              },
        },
      ],
    })),
  ];
  const selectedTab = selectedViewIndex < 0 ? 0 : selectedViewIndex + 1;

  const handleSearchChange = useCallback(
    (value: string) => onFilterChange({ ...filters, search: value }),
    [filters, onFilterChange],
  );

  const handleStatusChange = useCallback(
    (selected: string[]) => {
      const next = selected[0] as BundleStatusFilter | undefined;
      onFilterChange({ ...filters, status: next });
    },
    [filters, onFilterChange],
  );

  const handleTypeChange = useCallback(
    (selected: string[]) => {
      const next = selected[0];
      onFilterChange({ ...filters, type: next });
    },
    [filters, onFilterChange],
  );

  const handleClearAll = useCallback(() => {
    onFilterChange({ search: "", status: undefined, type: undefined });
  }, [onFilterChange]);

  const indexFilters = [
    {
      key: "status",
      label: "Status",
      filter: (
        <ChoiceList
          title="Status"
          titleHidden
          choices={STATUS_CHOICES}
          selected={filters.status ? [filters.status] : []}
          onChange={handleStatusChange}
        />
      ),
      shortcut: true,
    },
    {
      key: "type",
      label: "Type",
      filter: (
        <ChoiceList
          title="Type"
          titleHidden
          choices={bundleTypes.map((t) => ({ label: t, value: t }))}
          selected={filters.type ? [filters.type] : []}
          onChange={handleTypeChange}
        />
      ),
      shortcut: true,
    },
  ];

  const appliedFilters: Array<{
    key: string;
    label: string;
    onRemove: () => void;
  }> = [];
  const statusText = statusLabel(filters.status);
  if (statusText) {
    appliedFilters.push({
      key: "status",
      label: `Status: ${statusText}`,
      onRemove: () => onFilterChange({ ...filters, status: undefined }),
    });
  }
  if (filters.type) {
    appliedFilters.push({
      key: "type",
      label: `Type: ${filters.type}`,
      onRemove: () => onFilterChange({ ...filters, type: undefined }),
    });
  }

  return (
    <>
      <IndexFilters
        queryValue={filters.search ?? ""}
        queryPlaceholder="Search bundles by title…"
        onQueryChange={handleSearchChange}
        onQueryClear={() => onFilterChange({ ...filters, search: "" })}
        cancelAction={{ onAction: () => undefined }}
        tabs={tabs}
        selected={selectedTab}
        onSelect={(idx) => onViewSelect(idx === 0 ? -1 : idx - 1)}
        canCreateNewView
        onCreateNewView={async (label: string) => {
          await onSaveView(label);
          return true;
        }}
        sortOptions={SORT_OPTIONS.map((o) => ({
          label: o.label,
          value: o.key,
          directionLabel: o.label,
        }))}
        sortSelected={[sortKey(sort)]}
        onSort={(selected) => {
          const next = SORT_OPTIONS.find((o) => o.key === selected[0]);
          if (next) onSortChange(next.sort);
        }}
        filters={indexFilters}
        appliedFilters={appliedFilters}
        onClearAll={handleClearAll}
        mode={mode}
        setMode={setMode}
      />
      {/* View-mode toggle. Polaris doesn't ship a built-in
          IndexFilters slot for view modes, so we render our own
          ButtonGroup above the table body. */}
      <Box paddingBlockStart="200" paddingBlockEnd="200">
        <InlineStack align="end">
          <ButtonGroup variant="segmented">
            <Button
              pressed={viewMode === "table"}
              onClick={() => onViewModeChange("table")}
            >
              Table
            </Button>
            <Button
              pressed={viewMode === "compact"}
              onClick={() => onViewModeChange("compact")}
            >
              Compact
            </Button>
            <Button
              pressed={viewMode === "card"}
              onClick={() => onViewModeChange("card")}
            >
              Cards
            </Button>
          </ButtonGroup>
        </InlineStack>
      </Box>
      {viewMode === "card" ? (
        <BundleCardGrid
          rows={rows}
          selectedResources={selectedResources}
          onSelectionChange={handleSelectionChange}
          onRowClick={onRowClick}
          onBulkPublish={onBulkPublish}
          onBulkArchive={() => setBulkConfirm("archive")}
          onBulkDelete={() => setBulkConfirm("delete")}
          bulkBusy={bulkBusy}
        />
      ) : (
        <IndexTable
          itemCount={rows.length}
          condensed={viewMode === "compact"}
          headings={[
            { title: "Title" },
            { title: "Type" },
            { title: "Status" },
            { title: "" },
          ]}
          selectable
          selectedItemsCount={
            allResourcesSelected ? "All" : selectedResources.length
          }
          onSelectionChange={handleSelectionChange}
          promotedBulkActions={[
            ...(onBulkPublish
              ? [
                  {
                    content: "Publish",
                    onAction: async () => {
                      if (selectedResources.length === 0) return;
                      await onBulkPublish(selectedResources);
                      clearSelection();
                    },
                    disabled: bulkBusy,
                  },
                ]
              : []),
            ...(onBulkArchive
              ? [
                  {
                    content: "Archive",
                    onAction: () => setBulkConfirm("archive"),
                    disabled: bulkBusy,
                  },
                ]
              : []),
            ...(onBulkDelete
              ? [
                  {
                    content: "Delete",
                    onAction: () => setBulkConfirm("delete"),
                    disabled: bulkBusy,
                  },
                ]
              : []),
          ]}
        >
          {rows.map((b, i) => (
            <IndexTable.Row
              id={b.id}
              key={b.id}
              position={i}
              selected={selectedResources.includes(b.id)}
              onClick={() => onRowClick(b.id)}
            >
              <IndexTable.Cell>
                <Text as="span" fontWeight="semibold">
                  {b.title}
                </Text>
              </IndexTable.Cell>
              <IndexTable.Cell>{b.type}</IndexTable.Cell>
              <IndexTable.Cell>
                <Badge tone={b.status === "active" ? "success" : "info"}>
                  {b.status}
                </Badge>
              </IndexTable.Cell>
              <IndexTable.Cell>
                <Button
                  onClick={() => onRowClick(b.id)}
                  variant="tertiary"
                >
                  Edit
                </Button>
              </IndexTable.Cell>
            </IndexTable.Row>
          ))}
        </IndexTable>
      )}
      <Box paddingBlockStart="300">
        <InlineStack align="space-between" blockAlign="center">
          <Text as="p" tone="subdued" variant="bodySm">
            {total === 0
              ? "No bundles match the current filters."
              : `Page ${pagination.page} of ${pagination.totalPages} · ${total} bundle${total === 1 ? "" : "s"} total`}
          </Text>
          {(pagination.hasPrev || pagination.hasNext) && (
            <Pagination
              label={`${pagination.page} / ${pagination.totalPages}`}
              hasPrevious={pagination.hasPrev}
              hasNext={pagination.hasNext}
              onPrevious={() =>
                onPageChange(Math.max(1, pagination.page - 1))
              }
              onNext={() => onPageChange(pagination.page + 1)}
            />
          )}
        </InlineStack>
      </Box>

      {/* The built-in canCreateNewView modal is fine for the happy
          path; this fallback Modal is here for the explicit "Save
          view" action callers can wire into a top-level button if
          they ever need it. Hidden by default. */}
      <Modal
        open={saveModalOpen}
        onClose={() => {
          setSaveModalOpen(false);
          setSavingLabel("");
        }}
        title="Save current filters as a view"
        primaryAction={{
          content: "Save view",
          loading: saveBusy,
          disabled: savingLabel.trim().length === 0 || saveBusy,
          onAction: async () => {
            setSaveBusy(true);
            try {
              await onSaveView(savingLabel.trim());
              setSaveModalOpen(false);
              setSavingLabel("");
            } finally {
              setSaveBusy(false);
            }
          },
        }}
        secondaryActions={[
          {
            content: "Cancel",
            onAction: () => {
              setSaveModalOpen(false);
              setSavingLabel("");
            },
          },
        ]}
      >
        <Modal.Section>
          <TextField
            label="View name"
            value={savingLabel}
            onChange={setSavingLabel}
            autoComplete="off"
            placeholder="e.g. Active drafts"
            maxLength={40}
          />
        </Modal.Section>
      </Modal>

      <ConfirmDialog
        open={confirmDelete !== null}
        title="Delete this saved view?"
        body={
          <Text as="p">
            "{confirmDelete?.label}" will be removed. The bundles
            themselves are not affected — only this saved view.
          </Text>
        }
        confirmLabel="Delete"
        destructive
        onConfirm={async () => {
          if (confirmDelete) await onDeleteView(confirmDelete.id);
          setConfirmDelete(null);
        }}
        onCancel={() => setConfirmDelete(null)}
      />

      <ConfirmDialog
        open={bulkConfirm !== null}
        title={
          bulkConfirm === "delete"
            ? `Delete ${selectedResources.length} bundle${selectedResources.length === 1 ? "" : "s"}?`
            : `Archive ${selectedResources.length} bundle${selectedResources.length === 1 ? "" : "s"}?`
        }
        body={
          bulkConfirm === "delete"
            ? "Selected bundles will be hidden from the storefront and the list. Past orders that include them keep their history. This is reversible until the next GDPR shop-redact."
            : "Selected bundles will be removed from the storefront. They stay in the list under the Archived filter and can be moved back to draft."
        }
        confirmLabel={bulkConfirm === "delete" ? "Delete" : "Archive"}
        destructive={bulkConfirm === "delete"}
        loading={bulkBusy}
        onConfirm={async () => {
          const action = bulkConfirm;
          setBulkConfirm(null);
          if (action === "archive" && onBulkArchive) {
            await onBulkArchive(selectedResources);
          } else if (action === "delete" && onBulkDelete) {
            await onBulkDelete(selectedResources);
          }
          clearSelection();
        }}
        onCancel={() => setBulkConfirm(null)}
      />
    </>
  );
}
