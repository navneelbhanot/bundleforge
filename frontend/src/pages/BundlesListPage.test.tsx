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

import { BundlesListPage } from "./BundlesListPage";
import { ToastsProvider } from "../components/shell/Toasts";

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
      <ToastsProvider>
        <MemoryRouter initialEntries={["/"]}>
          <Routes>
            <Route path="/" element={<BundlesListPage />} />
          </Routes>
        </MemoryRouter>
      </ToastsProvider>
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

  it("initial fetch carries page + sort query params (M-178)", async () => {
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
              data: [],
              pagination: {
                page: 1,
                limit: 20,
                total: 0,
                totalPages: 1,
                hasNext: false,
                hasPrev: false,
              },
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
        calls.some((c) => c.includes("/api/v1/bundles?")),
      ).toBe(true),
    );
    const bundlesCall = calls.find((c) => c.includes("/api/v1/bundles?"))!;
    expect(bundlesCall).toContain("page=1");
    expect(bundlesCall).toContain("limit=20");
    expect(bundlesCall).toContain("sortBy=createdAt");
    expect(bundlesCall).toContain("sortOrder=desc");
  });

  it("clicking 'Browse templates' fetches /api/v1/bundles/templates and renders the modal (M-179)", async () => {
    vi.stubGlobal(
      "fetch",
      mockFetch(async (input) => {
        if (input.startsWith("/api/v1/bundles/templates")) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              data: [
                {
                  id: "holiday-gift-box",
                  label: "Holiday gift box",
                  description:
                    "Curated 3-product seasonal gift set with 15% off.",
                  category: "seasonal",
                  type: "fixed",
                  defaultTitle: "Holiday gift box",
                },
              ],
            }),
          };
        }
        if (input.startsWith("/api/v1/bundles")) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              data: [
                {
                  id: "b-1",
                  title: "Existing",
                  type: "fixed",
                  status: "active",
                  slug: "existing",
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

    const { container } = renderPage();
    // Wait for the populated-list page to render.
    await waitFor(() =>
      expect(screen.getByText("Existing")).toBeTruthy(),
    );

    // Polaris Page renders secondaryActions as buttons in the
    // page header. Click the "Browse templates" entry.
    const browseBtn = (
      Array.from(container.querySelectorAll("button")) as HTMLButtonElement[]
    ).find((b) => b.textContent?.trim() === "Browse templates");
    expect(browseBtn).toBeTruthy();
    browseBtn!.click();

    // Modal opens — assert the template heading from the
    // fixture appears (Polaris renders the modal into a portal).
    await waitFor(() =>
      expect(
        Array.from(document.querySelectorAll("h3")).some(
          (h) => h.textContent === "Holiday gift box",
        ),
      ).toBe(true),
    );
  });

  it("clicking a row's checkbox + bulk Publish POSTs to /api/v1/bundles/bulk/publish (M-177)", async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    vi.stubGlobal(
      "fetch",
      mockFetch(async (input, init) => {
        calls.push({ url: input, init });
        if (
          input.startsWith("/api/v1/bundles/bulk/")
        ) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              succeeded: ["b-1"],
              failed: [],
            }),
          };
        }
        if (input.startsWith("/api/v1/bundles")) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              data: [
                {
                  id: "b-1",
                  title: "Holiday",
                  type: "fixed",
                  status: "draft",
                  slug: "holiday",
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
    const { container } = renderPage();
    await waitFor(() =>
      expect(screen.getByText("Holiday")).toBeTruthy(),
    );

    // Click the row checkbox to select it. Polaris IndexTable
    // renders <input type="checkbox"> for each selectable row.
    const checkboxes = Array.from(
      container.querySelectorAll<HTMLInputElement>('input[type="checkbox"]'),
    );
    expect(checkboxes.length).toBeGreaterThan(0);
    fireEvent.click(checkboxes[0]);

    // Promoted "Publish" bulk action button appears in the
    // IndexFilters chrome after selection.
    await waitFor(() => {
      const publishBtn = (
        Array.from(document.querySelectorAll("button")) as HTMLButtonElement[]
      ).find((b) => b.textContent?.trim() === "Publish");
      expect(publishBtn).toBeTruthy();
    });
    const publishBtn = (
      Array.from(document.querySelectorAll("button")) as HTMLButtonElement[]
    ).find((b) => b.textContent?.trim() === "Publish")!;
    publishBtn.click();

    await waitFor(() =>
      expect(
        calls.some((c) => c.url === "/api/v1/bundles/bulk/publish"),
      ).toBe(true),
    );
    const bulkCall = calls.find(
      (c) => c.url === "/api/v1/bundles/bulk/publish",
    )!;
    const body = JSON.parse(String(bulkCall.init?.body ?? "{}"));
    expect(body.ids).toEqual(["b-1"]);
  });
});
