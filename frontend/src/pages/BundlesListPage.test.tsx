import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  render,
  screen,
  waitFor,
  cleanup,
} from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { AppProvider } from "@shopify/polaris";

import { BundlesListPage } from "./BundlesListPage";

const i18n = { Polaris: { Common: { cancel: "Cancel", save: "Save" } } };

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

function renderPage() {
  return render(
    <AppProvider i18n={i18n}>
      <MemoryRouter initialEntries={["/"]}>
        <Routes>
          <Route path="/" element={<BundlesListPage />} />
        </Routes>
      </MemoryRouter>
    </AppProvider>,
  );
}

beforeEach(() => {
  // Stub localStorage so the wizard-dismissed flag doesn't leak.
  try {
    window.localStorage.removeItem("bundleforge:onboarding-dismissed");
  } catch {
    /* noop */
  }
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("BundlesListPage", () => {
  it("renders the FreshShopDashboard for a brand-new shop with no bundles", async () => {
    vi.stubGlobal(
      "fetch",
      mockFetch(async (input) => {
        if (input.startsWith("/api/v1/bundles")) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              data: [],
              pagination: { total: 0 },
            }),
          };
        }
        return {
          ok: true,
          status: 200,
          json: async () => ({ savedViews: [] }),
        };
      }),
    );
    renderPage();
    await waitFor(() =>
      expect(
        screen.getByText(/No bundles yet — let's fix that/i),
      ).toBeTruthy(),
    );
  });

  it("renders the IndexFilters table when bundles exist", async () => {
    vi.stubGlobal(
      "fetch",
      mockFetch(async (input) => {
        if (input.startsWith("/api/v1/bundles")) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              data: [
                {
                  id: "b-1",
                  title: "Holiday Mix Box",
                  type: "fixed",
                  status: "active",
                  slug: "holiday-mix-box",
                },
              ],
              pagination: { total: 1 },
            }),
          };
        }
        return {
          ok: true,
          status: 200,
          json: async () => ({ savedViews: [] }),
        };
      }),
    );
    renderPage();
    await waitFor(() =>
      expect(screen.getByText("Holiday Mix Box")).toBeTruthy(),
    );
  });

  it("loads saved views from /api/v1/settings on mount", async () => {
    const calls: string[] = [];
    vi.stubGlobal(
      "fetch",
      mockFetch(async (input) => {
        calls.push(input);
        if (input.startsWith("/api/v1/bundles")) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              data: [
                {
                  id: "b-1",
                  title: "X",
                  type: "fixed",
                  status: "active",
                  slug: "x",
                },
              ],
              pagination: { total: 1 },
            }),
          };
        }
        if (input === "/api/v1/settings") {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              savedViews: [{ id: "v1", label: "Active drafts" }],
            }),
          };
        }
        return { ok: false, status: 404, json: async () => ({}) };
      }),
    );
    renderPage();
    await waitFor(() =>
      expect(calls.some((c) => c === "/api/v1/settings")).toBe(true),
    );
    // Saved view label appears in the tab strip.
    await waitFor(() =>
      expect(screen.getAllByText("Active drafts").length).toBeGreaterThan(0),
    );
  });
});
