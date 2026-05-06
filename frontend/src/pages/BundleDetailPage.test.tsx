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
      <MemoryRouter initialEntries={[`/bundles/bundle-1${hash}`]}>
        <Routes>
          <Route path="/bundles/:id" element={<BundleDetailPage />} />
        </Routes>
      </MemoryRouter>
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

  it("non-Setup placeholder tabs render the placeholder card pointing at their milestone", async () => {
    // Schedule (M-170), Display (M-171), and Customers (M-172) are
    // now wired. Use #inventory which is still placeholder for M-173.
    renderAt("#inventory");
    await waitFor(() =>
      expect(screen.getByText(/being built in/i)).toBeTruthy(),
    );
    expect(screen.getByText(/M-173/)).toBeTruthy();
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

    // Switch to a still-placeholder tab via the hash. M-170/171/172
    // wired Schedule, Display, and Customers — use #inventory which
    // remains a placeholder for M-173.
    if (typeof window !== "undefined") {
      window.history.replaceState(null, "", "/bundles/bundle-1#inventory");
      window.dispatchEvent(new HashChangeEvent("hashchange"));
    }
    await waitFor(() =>
      expect(screen.getByText(/being built in/i)).toBeTruthy(),
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
