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
  Button,
  ChoiceList,
  IndexFilters,
  IndexTable,
  Modal,
  TextField,
  Text,
  useIndexResourceState,
  useSetIndexFiltersMode,
} from "@shopify/polaris";

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

export interface SavedView {
  id: string;
  label: string;
  filters?: BundleListFilters;
  sort?: BundleSort;
}

export interface BundleRow {
  id: string;
  title: string;
  type: string;
  status: string;
  slug: string;
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
  onFilterChange: (next: BundleListFilters) => void;
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
    onFilterChange,
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
        filters={indexFilters}
        appliedFilters={appliedFilters}
        onClearAll={handleClearAll}
        mode={mode}
        setMode={setMode}
      />
      <IndexTable
        itemCount={rows.length}
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
      {total > rows.length && (
        <Text as="p" tone="subdued" alignment="center">
          Showing first {rows.length} of {total}. Refine the filters to
          narrow your view.
        </Text>
      )}

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

      <Modal
        open={confirmDelete !== null}
        onClose={() => setConfirmDelete(null)}
        title="Delete this saved view?"
        primaryAction={{
          content: "Delete",
          destructive: true,
          onAction: async () => {
            if (confirmDelete) await onDeleteView(confirmDelete.id);
            setConfirmDelete(null);
          },
        }}
        secondaryActions={[
          { content: "Cancel", onAction: () => setConfirmDelete(null) },
        ]}
      >
        <Modal.Section>
          <Text as="p">
            "{confirmDelete?.label}" will be removed. The bundles
            themselves are not affected — only this saved view.
          </Text>
        </Modal.Section>
      </Modal>

      <Modal
        open={bulkConfirm !== null}
        onClose={() => setBulkConfirm(null)}
        title={
          bulkConfirm === "delete"
            ? `Delete ${selectedResources.length} bundle${selectedResources.length === 1 ? "" : "s"}?`
            : `Archive ${selectedResources.length} bundle${selectedResources.length === 1 ? "" : "s"}?`
        }
        primaryAction={{
          content: bulkConfirm === "delete" ? "Delete" : "Archive",
          destructive: bulkConfirm === "delete",
          loading: bulkBusy,
          disabled: bulkBusy || selectedResources.length === 0,
          onAction: async () => {
            const action = bulkConfirm;
            setBulkConfirm(null);
            if (action === "archive" && onBulkArchive) {
              await onBulkArchive(selectedResources);
            } else if (action === "delete" && onBulkDelete) {
              await onBulkDelete(selectedResources);
            }
            clearSelection();
          },
        }}
        secondaryActions={[
          { content: "Cancel", onAction: () => setBulkConfirm(null) },
        ]}
      >
        <Modal.Section>
          <Text as="p">
            {bulkConfirm === "delete"
              ? "Selected bundles will be hidden from the storefront and the list. Past orders that include them keep their history. This is reversible until the next GDPR shop-redact."
              : "Selected bundles will be removed from the storefront. They stay in the list under the Archived filter and can be moved back to draft."}
          </Text>
        </Modal.Section>
      </Modal>
    </>
  );
}
