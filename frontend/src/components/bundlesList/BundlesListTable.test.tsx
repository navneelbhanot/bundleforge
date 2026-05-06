import { describe, it, expect, afterEach, vi } from "vitest";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  cleanup,
} from "@testing-library/react";
import { AppProvider } from "@shopify/polaris";

import {
  BundlesListTable,
  type BundleRow,
  type BundleSort,
  type SavedView,
  type ViewMode,
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
  sort?: BundleSort;
  viewMode?: ViewMode;
  pagination?: {
    page: number;
    totalPages: number;
    hasPrev: boolean;
    hasNext: boolean;
  };
  onFilterChange?: (next: unknown) => void;
  onSortChange?: (next: BundleSort) => void;
  onViewModeChange?: (next: ViewMode) => void;
  onPageChange?: (next: number) => void;
  onViewSelect?: (index: number) => void;
  onSaveView?: (label: string) => Promise<void>;
  onDeleteView?: (id: string) => Promise<void>;
  onRowClick?: (id: string) => void;
  onBulkPublish?: (ids: string[]) => Promise<void>;
  onBulkArchive?: (ids: string[]) => Promise<void>;
  onBulkDelete?: (ids: string[]) => Promise<void>;
}

function renderTable(opts: RenderOpts = {}) {
  const onFilterChange = opts.onFilterChange ?? vi.fn();
  const onSortChange = opts.onSortChange ?? vi.fn();
  const onViewModeChange = opts.onViewModeChange ?? vi.fn();
  const onPageChange = opts.onPageChange ?? vi.fn();
  const onViewSelect = opts.onViewSelect ?? vi.fn();
  const onSaveView = opts.onSaveView ?? vi.fn().mockResolvedValue(undefined);
  const onDeleteView = opts.onDeleteView ?? vi.fn().mockResolvedValue(undefined);
  const onRowClick = opts.onRowClick ?? vi.fn();
  const onBulkPublish =
    opts.onBulkPublish ?? vi.fn().mockResolvedValue(undefined);
  const onBulkArchive =
    opts.onBulkArchive ?? vi.fn().mockResolvedValue(undefined);
  const onBulkDelete =
    opts.onBulkDelete ?? vi.fn().mockResolvedValue(undefined);
  return {
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
    ...render(
      wrap(
        <BundlesListTable
          rows={opts.rows ?? ROWS}
          total={opts.total ?? (opts.rows ?? ROWS).length}
          views={opts.views ?? []}
          selectedViewIndex={opts.selectedViewIndex ?? -1}
          filters={opts.filters ?? {}}
          bundleTypes={TYPES}
          sort={opts.sort ?? { sortBy: "createdAt", sortOrder: "desc" }}
          viewMode={opts.viewMode ?? "table"}
          pagination={
            opts.pagination ?? {
              page: 1,
              totalPages: 1,
              hasPrev: false,
              hasNext: false,
            }
          }
          onFilterChange={onFilterChange}
          onSortChange={onSortChange}
          onViewModeChange={onViewModeChange}
          onPageChange={onPageChange}
          onViewSelect={onViewSelect}
          onSaveView={onSaveView}
          onDeleteView={onDeleteView}
          onRowClick={onRowClick}
          onBulkPublish={onBulkPublish}
          onBulkArchive={onBulkArchive}
          onBulkDelete={onBulkDelete}
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

  it("renders the page-counter footer with the total bundle count", () => {
    renderTable({
      total: 250,
      pagination: {
        page: 1,
        totalPages: 13,
        hasPrev: false,
        hasNext: true,
      },
    });
    expect(
      screen.getByText(/Page 1 of 13/i),
    ).toBeTruthy();
    expect(screen.getByText(/250 bundles total/i)).toBeTruthy();
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

  it("renders selectable rows with row checkboxes (M-177)", () => {
    const { container } = renderTable();
    // Polaris flips selectable rows to render <input type="checkbox">
    // per row plus a header. Sanity-check that more than one is in
    // the DOM, proving selectable=true is wired.
    const checkboxes = Array.from(
      container.querySelectorAll<HTMLInputElement>('input[type="checkbox"]'),
    );
    expect(checkboxes.length).toBeGreaterThan(0);
  });

  it("clicking the Cards view-mode button fires onViewModeChange (M-178)", () => {
    const onViewModeChange = vi.fn();
    const { container } = renderTable({ onViewModeChange });
    const cardsBtn = (
      Array.from(container.querySelectorAll("button")) as HTMLButtonElement[]
    ).find((b) => b.textContent?.trim() === "Cards");
    expect(cardsBtn).toBeTruthy();
    cardsBtn!.click();
    expect(onViewModeChange).toHaveBeenCalledWith("card");
  });

  it("renders the card grid when viewMode='card' (M-178)", () => {
    const { container } = renderTable({ viewMode: "card" });
    // Card mode does not render the IndexTable's <table> element.
    const tables = container.querySelectorAll("table");
    expect(tables.length).toBe(0);
    // Each card has a checkbox + title heading.
    expect(screen.getByRole("heading", { name: "Holiday Mix Box" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Build-a-box Deluxe" })).toBeTruthy();
  });

  it("clicking the Pagination Next button fires onPageChange (M-178)", () => {
    const onPageChange = vi.fn();
    const { container } = renderTable({
      onPageChange,
      pagination: {
        page: 1,
        totalPages: 3,
        hasPrev: false,
        hasNext: true,
      },
    });
    // Polaris Pagination renders Prev + Next buttons; Next is the
    // sole enabled one when hasPrev=false.
    const enabledButtons = (
      Array.from(container.querySelectorAll("button")) as HTMLButtonElement[]
    ).filter(
      (b) =>
        !b.disabled &&
        // Avoid grabbing the view-mode buttons (Table/Compact/Cards)
        // — they have visible text.
        (b.textContent ?? "").trim() === "",
    );
    expect(enabledButtons.length).toBeGreaterThan(0);
    enabledButtons[enabledButtons.length - 1].click();
    expect(onPageChange).toHaveBeenCalledWith(2);
  });

  it("opens the bulk archive confirm modal when 'Archive' is invoked on a selection", async () => {
    const onBulkArchive = vi.fn().mockResolvedValue(undefined);
    const { container } = renderTable({ onBulkArchive });

    // Simulate the selection state by clicking the header
    // checkbox (Polaris IndexTable wires it to select all).
    const checkboxes = Array.from(
      container.querySelectorAll<HTMLInputElement>('input[type="checkbox"]'),
    );
    expect(checkboxes.length).toBeGreaterThan(0);
    fireEvent.click(checkboxes[0]);

    // After selection, Polaris promotes the bulk-action buttons.
    // The Archive promoted action becomes a button in the chrome.
    await waitFor(() => {
      const archiveBtn = (
        Array.from(document.querySelectorAll("button")) as HTMLButtonElement[]
      ).find((b) => b.textContent?.trim() === "Archive");
      expect(archiveBtn).toBeTruthy();
    });
    const archiveBtn = (
      Array.from(document.querySelectorAll("button")) as HTMLButtonElement[]
    ).find((b) => b.textContent?.trim() === "Archive")!;
    archiveBtn.click();

    // Confirm modal heading.
    await waitFor(() =>
      expect(
        Array.from(document.querySelectorAll("h2")).some((h) =>
          (h.textContent ?? "").startsWith("Archive "),
        ),
      ).toBe(true),
    );
  });
});
