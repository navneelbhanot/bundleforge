import { describe, it, expect, afterEach, vi } from "vitest";
import {
  render,
  screen,
  waitFor,
  cleanup,
} from "@testing-library/react";
import { AppProvider } from "@shopify/polaris";

import { ActivityTab } from "./ActivityTab";

const i18n = { Polaris: { Common: { cancel: "Cancel", save: "Save" } } };

function wrap(node: React.ReactNode) {
  return <AppProvider i18n={i18n}>{node}</AppProvider>;
}

afterEach(() => {
  cleanup();
});

describe("ActivityTab", () => {
  it("renders empty state when the server returns no rows", async () => {
    const fetcher = vi.fn().mockResolvedValueOnce({
      data: [],
      pagination: {
        page: 1,
        limit: 20,
        total: 0,
        totalPages: 1,
        hasNext: false,
        hasPrev: false,
      },
    });
    render(wrap(<ActivityTab bundleId="b-1" fetcher={fetcher} />));
    await waitFor(() =>
      expect(screen.getByText(/No activity yet/i)).toBeTruthy(),
    );
  });

  it("renders one row per activity entry with action + summary", async () => {
    const fetcher = vi.fn().mockResolvedValueOnce({
      data: [
        {
          id: "act-1",
          action: "published",
          summary: "Bundle published",
          createdAt: new Date().toISOString(),
        },
        {
          id: "act-2",
          action: "display_updated",
          summary: "Display settings updated",
          createdAt: new Date().toISOString(),
        },
      ],
      pagination: {
        page: 1,
        limit: 20,
        total: 2,
        totalPages: 1,
        hasNext: false,
        hasPrev: false,
      },
    });
    const { container } = render(
      wrap(<ActivityTab bundleId="b-1" fetcher={fetcher} />),
    );
    await waitFor(() =>
      expect(container.textContent).toContain("Bundle published"),
    );
    expect(container.textContent).toContain("Display settings updated");
    expect(container.textContent).toContain("published");
    expect(container.textContent).toContain("display updated");
  });

  it("clicking Next refetches with page=2", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce({
        data: [
          {
            id: "act-1",
            action: "published",
            summary: "p1",
            createdAt: new Date().toISOString(),
          },
        ],
        pagination: {
          page: 1,
          limit: 20,
          total: 25,
          totalPages: 2,
          hasNext: true,
          hasPrev: false,
        },
      })
      .mockResolvedValueOnce({
        data: [
          {
            id: "act-2",
            action: "archived",
            summary: "p2",
            createdAt: new Date().toISOString(),
          },
        ],
        pagination: {
          page: 2,
          limit: 20,
          total: 25,
          totalPages: 2,
          hasNext: false,
          hasPrev: true,
        },
      });

    const { container } = render(
      wrap(<ActivityTab bundleId="b-1" fetcher={fetcher} />),
    );
    await waitFor(() => expect(container.textContent).toContain("p1"));
    // Polaris Pagination renders two buttons (Previous + Next).
    // With hasPrev=false the Previous button is disabled, so the
    // sole enabled button is Next.
    const enabledButtons = (
      Array.from(container.querySelectorAll("button")) as HTMLButtonElement[]
    ).filter((b) => !b.disabled);
    expect(enabledButtons.length).toBeGreaterThan(0);
    enabledButtons[enabledButtons.length - 1].click();
    await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(2));
    expect(fetcher.mock.calls[1][0]).toContain("page=2");
  });
});
