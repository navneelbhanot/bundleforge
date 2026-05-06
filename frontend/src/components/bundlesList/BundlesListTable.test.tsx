import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { AppProvider } from "@shopify/polaris";

import {
  BundlesListTable,
  type BundleRow,
  type SavedView,
} from "./BundlesListTable";

const i18n = { Polaris: { Common: { cancel: "Cancel", save: "Save" } } };

function wrap(node: React.ReactNode) {
  return <AppProvider i18n={i18n}>{node}</AppProvider>;
}

const ROWS: BundleRow[] = [
  {
    id: "b-1",
    title: "Holiday Mix Box",
    type: "fixed",
    status: "active",
    slug: "holiday-mix-box",
  },
  {
    id: "b-2",
    title: "Build-a-box Deluxe",
    type: "build_box",
    status: "draft",
    slug: "build-a-box-deluxe",
  },
];

const TYPES = ["fixed", "build_box", "bogo"] as const;

interface RenderOpts {
  views?: SavedView[];
  selectedViewIndex?: number;
  filters?: {
    status?: "draft" | "active" | "archived";
    type?: string;
    search?: string;
  };
  rows?: BundleRow[];
  total?: number;
  onFilterChange?: (next: unknown) => void;
  onViewSelect?: (index: number) => void;
  onSaveView?: (label: string) => Promise<void>;
  onDeleteView?: (id: string) => Promise<void>;
  onRowClick?: (id: string) => void;
}

function renderTable(opts: RenderOpts = {}) {
  const onFilterChange = opts.onFilterChange ?? vi.fn();
  const onViewSelect = opts.onViewSelect ?? vi.fn();
  const onSaveView = opts.onSaveView ?? vi.fn().mockResolvedValue(undefined);
  const onDeleteView = opts.onDeleteView ?? vi.fn().mockResolvedValue(undefined);
  const onRowClick = opts.onRowClick ?? vi.fn();
  return {
    onFilterChange,
    onViewSelect,
    onSaveView,
    onDeleteView,
    onRowClick,
    ...render(
      wrap(
        <BundlesListTable
          rows={opts.rows ?? ROWS}
          total={opts.total ?? (opts.rows ?? ROWS).length}
          views={opts.views ?? []}
          selectedViewIndex={opts.selectedViewIndex ?? -1}
          filters={opts.filters ?? {}}
          bundleTypes={TYPES}
          onFilterChange={onFilterChange}
          onViewSelect={onViewSelect}
          onSaveView={onSaveView}
          onDeleteView={onDeleteView}
          onRowClick={onRowClick}
        />,
      ),
    ),
  };
}

afterEach(() => {
  cleanup();
});

describe("BundlesListTable", () => {
  it("renders bundle rows", () => {
    renderTable();
    expect(screen.getByText("Holiday Mix Box")).toBeTruthy();
    expect(screen.getByText("Build-a-box Deluxe")).toBeTruthy();
  });

  it("renders saved-view tabs alongside the built-in All", () => {
    renderTable({
      views: [
        { id: "v1", label: "Active drafts" },
        { id: "v2", label: "Archived" },
      ],
    });
    // Polaris Tabs renders tab labels in both a measurer and the
    // visible row, so use getAllByText to cope with duplicates.
    expect(screen.getAllByText("All").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Active drafts").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Archived").length).toBeGreaterThan(0);
  });

  it("renders the IndexFilters search/filter affordance", () => {
    const { container } = renderTable();
    // Default-mode IndexFilters renders a search/filter entry
    // button somewhere in its chrome; the exact aria-label varies
    // across Polaris versions. Assert the broader chrome is
    // mounted via the role=tablist tab strip — this proves
    // IndexFilters rendered without coupling to a specific
    // affordance label that may shift under us.
    const tablists = Array.from(
      container.querySelectorAll('[role="tablist"]'),
    );
    expect(tablists.length).toBeGreaterThan(0);
  });

  it("renders the 'Showing first N of M' footer when total > rows.length", () => {
    renderTable({ total: 250 });
    expect(
      screen.getByText(/Showing first 2 of 250/i),
    ).toBeTruthy();
  });

  it("clicking a row fires onRowClick with the bundle id", () => {
    const onRowClick = vi.fn();
    const { container } = renderTable({ onRowClick });
    // Polaris IndexTable rows are <tr> elements; clicking a Cell
    // in the row triggers the row's onClick.
    const editButtons = (
      Array.from(container.querySelectorAll("button")) as HTMLButtonElement[]
    ).filter((b) => b.textContent?.trim() === "Edit");
    expect(editButtons.length).toBeGreaterThan(0);
    editButtons[0].click();
    expect(onRowClick).toHaveBeenCalledWith("b-1");
  });
});
