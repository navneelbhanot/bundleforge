import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, waitFor, cleanup } from "@testing-library/react";
import { AppProvider } from "@shopify/polaris";

import { PerformanceTab } from "./PerformanceTab";

const i18n = { Polaris: { Common: { cancel: "Cancel", save: "Save" } } };

function wrap(node: React.ReactNode) {
  return <AppProvider i18n={i18n}>{node}</AppProvider>;
}

afterEach(() => {
  cleanup();
});

describe("PerformanceTab", () => {
  it("renders empty state when all event counts are zero", async () => {
    const fetcher = vi.fn().mockResolvedValueOnce({
      bundleId: "b-1",
      groups: [],
    });
    render(
      wrap(<PerformanceTab bundleId="b-1" fetcher={fetcher} />),
    );
    await waitFor(() =>
      expect(screen.getByText(/No performance data yet/i)).toBeTruthy(),
    );
  });

  it("renders KPI numbers from a populated response", async () => {
    const fetcher = vi.fn().mockResolvedValueOnce({
      bundleId: "b-1",
      groups: [
        { eventType: "view", count: 1000, revenue: 0 },
        { eventType: "add_to_cart", count: 200, revenue: 0 },
        { eventType: "purchase", count: 50, revenue: 1234.56 },
      ],
    });
    const { container } = render(
      wrap(<PerformanceTab bundleId="b-1" fetcher={fetcher} />),
    );
    await waitFor(() =>
      expect(container.textContent).toContain("Funnel"),
    );
    expect(container.textContent).toContain("1000");
    expect(container.textContent).toContain("200");
    expect(container.textContent).toContain("50");
    expect(container.textContent).toContain("$1234.56");
  });

  it("computes conversion rate as purchases / views", async () => {
    const fetcher = vi.fn().mockResolvedValueOnce({
      bundleId: "b-1",
      groups: [
        { eventType: "view", count: 200, revenue: 0 },
        { eventType: "purchase", count: 10, revenue: 100 },
      ],
    });
    const { container } = render(
      wrap(<PerformanceTab bundleId="b-1" fetcher={fetcher} />),
    );
    await waitFor(() => expect(container.textContent).toContain("5.0%"));
  });
});
