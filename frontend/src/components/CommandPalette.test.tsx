import { describe, it, expect, afterEach, vi } from "vitest";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  cleanup,
} from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { AppProvider } from "@shopify/polaris";

const navigateMock = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<
    typeof import("react-router-dom")
  >("react-router-dom");
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

import { CommandPalette } from "./CommandPalette";

const i18n = { Polaris: { Common: { cancel: "Cancel", save: "Save" } } };

function renderPalette(
  overrides: Partial<{
    fetcher: (path: string) => Promise<{ data: unknown[] }>;
  }> = {},
) {
  const fetcher =
    overrides.fetcher ??
    vi.fn().mockResolvedValue({ data: [] });
  return {
    fetcher,
    ...render(
      <AppProvider i18n={i18n}>
        <MemoryRouter>
          <CommandPalette fetcher={fetcher as never} initialOpen />
        </MemoryRouter>
      </AppProvider>,
    ),
  };
}

afterEach(() => {
  cleanup();
  navigateMock.mockReset();
});

describe("CommandPalette", () => {
  it("renders the page list when query is empty (no API hit)", () => {
    const fetcher = vi.fn().mockResolvedValue({ data: [] });
    renderPalette({ fetcher });
    expect(screen.getByText("Bundles")).toBeTruthy();
    expect(screen.getByText("Orders")).toBeTruthy();
    expect(screen.getByText("Settings")).toBeTruthy();
    // Action list also visible when query is empty.
    expect(screen.getByText("Create bundle")).toBeTruthy();
    expect(screen.getByText("Browse templates")).toBeTruthy();
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("typing a query filters the page list by substring", async () => {
    renderPalette();
    const search = document.querySelector(
      'input[placeholder*="Search bundles"]',
    ) as HTMLInputElement;
    expect(search).toBeTruthy();
    fireEvent.change(search, { target: { value: "settings" } });

    await waitFor(() =>
      expect(screen.getByText("Settings")).toBeTruthy(),
    );
    // Page entries that don't match are filtered out.
    expect(screen.queryByText("Orders")).toBeNull();
    expect(screen.queryByText("Inventory")).toBeNull();
  });

  it("typing a query hits /api/v1/bundles?search=...&limit=10 (debounced)", async () => {
    const fetcher = vi.fn().mockResolvedValue({
      data: [
        { id: "b-1", title: "VIP Holiday Box", type: "fixed" },
      ],
    });
    renderPalette({ fetcher });
    const search = document.querySelector(
      'input[placeholder*="Search bundles"]',
    ) as HTMLInputElement;
    fireEvent.change(search, { target: { value: "vip" } });

    await waitFor(() => expect(fetcher).toHaveBeenCalled(), { timeout: 2000 });
    expect(fetcher.mock.calls[0][0]).toContain("/api/v1/bundles?search=vip");
    expect(fetcher.mock.calls[0][0]).toContain("limit=10");
    // Result row appears once the response resolves.
    await waitFor(() =>
      expect(screen.getByText("VIP Holiday Box")).toBeTruthy(),
    );
  });

  it("clicking a page result navigates to its path", async () => {
    renderPalette();
    // Click "Settings" row — there are two matches in the DOM
    // (the section heading and the button), pick the button.
    const buttons = (
      Array.from(document.querySelectorAll("button")) as HTMLButtonElement[]
    ).filter((b) => b.textContent?.includes("Settings"));
    expect(buttons.length).toBeGreaterThan(0);
    buttons[0].click();
    await waitFor(() =>
      expect(navigateMock).toHaveBeenCalledWith("/settings"),
    );
  });
});
