import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  cleanup,
} from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { AppProvider } from "@shopify/polaris";

import { BundleDetailPage } from "./BundleDetailPage";
import { ToastsProvider } from "../components/shell/Toasts";

const i18n = { Polaris: { Common: { cancel: "Cancel", save: "Save" } } };

const BUNDLE_FIXTURE = {
  id: "bundle-1",
  title: "Holiday Mix Box",
  slug: "holiday-mix-box",
  type: "fixed",
  status: "draft",
  description: "Curated holiday set",
  config: {},
  items: [],
  pricingRules: [],
};

interface FetchResponse {
  ok: boolean;
  status: number;
  json: () => Promise<unknown>;
}

function mockFetch(
  responder: (
    input: string,
    init?: RequestInit,
  ) => Promise<FetchResponse>,
): ReturnType<typeof vi.fn> {
  return vi.fn(
    (input: string, init?: RequestInit) => responder(input, init) as never,
  );
}

function renderAt(hash: string) {
  // Browser-style hash on the location.
  if (typeof window !== "undefined") {
    window.history.replaceState(null, "", `/bundles/bundle-1${hash}`);
  }
  return render(
    <AppProvider i18n={i18n}>
      <ToastsProvider>
        <MemoryRouter initialEntries={[`/bundles/bundle-1${hash}`]}>
          <Routes>
            <Route path="/bundles/:id" element={<BundleDetailPage />} />
          </Routes>
        </MemoryRouter>
      </ToastsProvider>
    </AppProvider>,
  );
}

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    mockFetch(async (_input, init) => {
      if (!init || init.method === undefined || init.method === "GET") {
        return {
          ok: true,
          status: 200,
          json: async () => BUNDLE_FIXTURE,
        };
      }
      return {
        ok: true,
        status: 200,
        json: async () => BUNDLE_FIXTURE,
      };
    }),
  );
  if (typeof window !== "undefined") {
    window.history.replaceState(null, "", "/bundles/bundle-1");
  }
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("BundleDetailPage tab shell", () => {
  it("renders all 8 tab labels", async () => {
    renderAt("");
    await waitFor(() =>
      expect(
        screen.getByRole("heading", { name: "Details", level: 2 }),
      ).toBeTruthy(),
    );
    for (const label of [
      "Setup",
      "Schedule",
      "Display",
      "Customers",
      "Inventory",
      "Performance",
      "Activity",
      "Advanced",
    ]) {
      // Polaris Tabs renders measurer + visible tabs, so getAllByText.
      expect(screen.getAllByText(label).length).toBeGreaterThan(0);
    }
  });

  it("Setup tab shows Details / Items / Pricing rules / Type config sections", async () => {
    renderAt("");
    await waitFor(() =>
      expect(
        screen.getByRole("heading", { name: "Details", level: 2 }),
      ).toBeTruthy(),
    );
    // Setup-tab cards render unconditionally so the form state survives
    // tab switches. Their headings are visible at h2 level.
    expect(
      screen.getByRole("heading", { name: "Details", level: 2 }),
    ).toBeTruthy();
    expect(
      screen.getByRole("heading", { name: "Items", level: 2 }),
    ).toBeTruthy();
    // Pricing rules heading lives in PricingRulesEditor.
    expect(
      screen.getByRole("heading", { name: "Pricing rules", level: 2 }),
    ).toBeTruthy();
    // TypeConfigPanel for "fixed" renders heading "Fixed bundle".
    expect(
      screen.getByRole("heading", { name: "Fixed bundle", level: 2 }),
    ).toBeTruthy();
  });

  it("hash routing: deep-link to #advanced renders the Advanced tab content (M-175 wired, closes Phase R2)", async () => {
    renderAt("#advanced");
    await waitFor(() =>
      expect(
        screen.getByRole("heading", {
          name: "Search engine listing",
          level: 2,
        }),
      ).toBeTruthy(),
    );
  });

  it("hash routing: deep-link to #performance renders the Performance tab content (M-174 wired)", async () => {
    // The shared mockFetch returns BUNDLE_FIXTURE for every URL,
    // which has no `groups`. PerformanceTab treats that as zero
    // events and falls through to its empty state.
    renderAt("#performance");
    await waitFor(() =>
      expect(screen.getByText(/No performance data yet/i)).toBeTruthy(),
    );
  });

  it("hash routing: deep-link to #activity renders the Activity tab content (M-174 wired)", async () => {
    // Same shape mismatch as above — ActivityTab's empty state
    // proves the tab is wired.
    renderAt("#activity");
    await waitFor(() =>
      expect(screen.getByText(/No activity yet/i)).toBeTruthy(),
    );
  });

  it("hash routing: deep-link to #inventory renders the Inventory tab content (M-173 wired)", async () => {
    renderAt("#inventory");
    await waitFor(() =>
      expect(
        screen.getByRole("heading", {
          name: "Low-stock thresholds",
          level: 2,
        }),
      ).toBeTruthy(),
    );
  });

  it("hash routing: deep-link to #customers renders the Customers tab content (M-172 wired)", async () => {
    renderAt("#customers");
    await waitFor(() =>
      expect(
        screen.getByRole("heading", {
          name: "Tag-based eligibility",
          level: 2,
        }),
      ).toBeTruthy(),
    );
  });

  it("hash routing: deep-link to #display renders the Display tab content (M-171 wired)", async () => {
    renderAt("#display");
    await waitFor(() =>
      expect(
        screen.getByRole("heading", { name: "Layout & visual style", level: 2 }),
      ).toBeTruthy(),
    );
  });

  it("hash routing: deep-link to #schedule renders the Schedule tab content (M-170 wired)", async () => {
    renderAt("#schedule");
    await waitFor(() =>
      expect(
        screen.getByRole("heading", { name: "Window", level: 2 }),
      ).toBeTruthy(),
    );
    expect(
      screen.getByRole("heading", { name: "Recurrence", level: 2 }),
    ).toBeTruthy();
  });

  it("switching tabs preserves dirty title field", async () => {
    const { container } = renderAt("");
    await waitFor(() =>
      expect(
        screen.getByRole("heading", { name: "Details", level: 2 }),
      ).toBeTruthy(),
    );

    // Find the title input (defaults to "Holiday Mix Box") and edit it.
    const titleInput = Array.from(
      container.querySelectorAll<HTMLInputElement>("input"),
    ).find((i) => i.value === "Holiday Mix Box");
    expect(titleInput).toBeTruthy();
    fireEvent.change(titleInput!, { target: { value: "Edited title" } });

    // After M-175, every tab is wired — there's no placeholder
    // fallback to assert against. Switch to Advanced (one of the
    // simpler non-Setup tabs) and verify its real content
    // renders, proving the tab actually changed.
    if (typeof window !== "undefined") {
      window.history.replaceState(null, "", "/bundles/bundle-1#advanced");
      window.dispatchEvent(new HashChangeEvent("hashchange"));
    }
    await waitFor(() =>
      expect(
        screen.getByRole("heading", {
          name: "Search engine listing",
          level: 2,
        }),
      ).toBeTruthy(),
    );

    // Switch back to Setup — the dirty title must still be there.
    if (typeof window !== "undefined") {
      window.history.replaceState(null, "", "/bundles/bundle-1#setup");
      window.dispatchEvent(new HashChangeEvent("hashchange"));
    }
    await waitFor(() => {
      const stillThere = Array.from(
        container.querySelectorAll<HTMLInputElement>("input"),
      ).find((i) => i.value === "Edited title");
      expect(stillThere).toBeTruthy();
    });
  });
});
