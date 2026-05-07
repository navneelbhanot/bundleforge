/**
 * Bundle compact list (M-178 polish).
 *
 * A denser-than-Table, prettier-than-`condensed` view of the
 * bundle list. Each row is a clickable horizontal lane with:
 * selection checkbox, title (clickable), type, status badge, and
 * Edit action. Hover highlight + 1px border between rows.
 *
 * Replaces the previous `<IndexTable condensed={true}>` rendering,
 * which stripped column headers and visual structure leaving every
 * row as one ugly text line.
 *
 * Mirrors BundleCardGrid's selection + bulk-action API so the
 * parent's bulk handlers wire in identically.
 */
import {
  Badge,
  BlockStack,
  Box,
  Button,
  ButtonGroup,
  IndexTableSelectionType,
  InlineStack,
  Text,
} from "@shopify/polaris";

import type { BundleRow } from "./BundlesListTable";

export type SelectionChangeFn = (
  selectionType: IndexTableSelectionType,
  toggleType: boolean,
  selection?: string | [number, number],
) => void;

export interface BundleCompactListProps {
  rows: BundleRow[];
  selectedResources: string[];
  onSelectionChange: SelectionChangeFn;
  onRowClick: (id: string) => void;
  onBulkPublish?: (ids: string[]) => Promise<void>;
  onBulkArchive: () => void;
  onBulkDelete: () => void;
  bulkBusy: boolean;
}

function statusTone(
  status: string,
): "success" | "info" | "warning" | "attention" {
  switch (status) {
    case "active":
      return "success";
    case "archived":
      return "warning";
    case "draft":
      return "info";
    default:
      return "attention";
  }
}

export function BundleCompactList({
  rows,
  selectedResources,
  onSelectionChange,
  onRowClick,
  onBulkPublish,
  onBulkArchive,
  onBulkDelete,
  bulkBusy,
}: BundleCompactListProps): JSX.Element {
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
      <Box
        borderColor="border"
        borderWidth="025"
        borderRadius="200"
        background="bg-surface"
      >
        {rows.map((b, idx) => {
          const selected = selectedResources.includes(b.id);
          return (
            <div
              key={b.id}
              role="button"
              tabIndex={0}
              aria-label={`Open ${b.title}`}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "10px 14px",
                borderBottom:
                  idx === rows.length - 1
                    ? "none"
                    : "1px solid var(--p-color-border-subdued)",
                background: selected
                  ? "var(--p-color-bg-surface-selected)"
                  : "transparent",
                transition: "background 100ms ease",
                cursor: "pointer",
              }}
              onClick={(e) => {
                // Don't navigate if the click came from a control —
                // checkbox or button handle their own clicks.
                const target = e.target as HTMLElement;
                if (target.closest("input, button, a, label")) return;
                onRowClick(b.id);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  const target = e.target as HTMLElement;
                  if (target.closest("input, button, a, label")) return;
                  e.preventDefault();
                  onRowClick(b.id);
                }
              }}
              onMouseEnter={(e) => {
                if (!selected) {
                  e.currentTarget.style.background =
                    "var(--p-color-bg-surface-hover)";
                }
              }}
              onMouseLeave={(e) => {
                if (!selected) {
                  e.currentTarget.style.background = "transparent";
                }
              }}
            >
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
              <div style={{ flex: 1, minWidth: 0 }}>
                <InlineStack gap="200" blockAlign="center" wrap={false}>
                  <button
                    type="button"
                    onClick={() => onRowClick(b.id)}
                    style={{
                      background: "transparent",
                      border: "none",
                      cursor: "pointer",
                      padding: 0,
                      fontWeight: 600,
                      fontSize: 14,
                      color: "var(--p-color-text)",
                      textAlign: "left",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      maxWidth: 320,
                    }}
                  >
                    {b.title}
                  </button>
                  <Text as="span" tone="subdued" variant="bodySm">
                    {b.type}
                  </Text>
                </InlineStack>
              </div>
              <Badge tone={statusTone(b.status)}>{b.status}</Badge>
              <Button
                size="slim"
                variant="tertiary"
                onClick={() => onRowClick(b.id)}
              >
                Edit
              </Button>
            </div>
          );
        })}
        {rows.length === 0 ? (
          <Box padding="400">
            <Text as="p" tone="subdued" alignment="center">
              No bundles match the current filters.
            </Text>
          </Box>
        ) : null}
      </Box>
    </BlockStack>
  );
}
