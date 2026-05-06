import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  render,
  screen,
  waitFor,
  cleanup,
} from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { AppProvider } from "@shopify/polaris";

import { DashboardPage } from "./DashboardPage";
import { ToastsProvider } from "../components/shell/Toasts";

const i18n = { Polaris: { Common: { cancel: "Cancel", save: "Save" } } };

interface FetchResponse {
  ok: boolean;
  status: number;
  json: () => Promise<unknown>;
}

function ok(body: unknown): FetchResponse {
  return { ok: true, status: 200, json: () => Promise.resolve(body) };
}

function fail(status: number): FetchResponse {
  return { ok: false, status, json: () => Promise.reject(new Error(`HTTP ${status}`)) };
}

function mockFetch(
  responder: (input: string) => FetchResponse,
): ReturnType<typeof vi.fn> {
  return vi.fn((input: string) => Promise.resolve(responder(input)) as never);
}

function renderPage() {
  return render(
    <AppProvider i18n={i18n}>
      <ToastsProvider>
        <MemoryRouter initialEntries={["/"]}>
          <Routes>
            <Route path="/" element={<DashboardPage />} />
          </Routes>
        </MemoryRouter>
      </ToastsProvider>
    </AppProvider>,
  );
}

describe("DashboardPage (M-184)", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("renders the fresh-shop welcome surface when total === 0", async () => {
    vi.stubGlobal(
      "fetch",
      mockFetch((url) => {
        if (url.startsWith("/api/v1/bundles?limit=1")) {
          return ok({ data: [], pagination: { page: 1, limit: 1, total: 0, totalPages: 0 } });
        }
        return ok({});
      }),
    );
    renderPage();
    await waitFor(() => {
      expect(screen.getByText(/No bundles yet/i)).toBeInTheDocument();
    });
    expect(screen.getByRole("button", { name: /Create your first bundle/i })).toBeInTheDocument();
  });

  it("renders the seven widget cards when bundles exist", async () => {
    vi.stubGlobal(
      "fetch",
      mockFetch((url) => {
        if (url.startsWith("/api/v1/bundles?limit=1")) {
          return ok({ data: [], pagination: { page: 1, limit: 1, total: 5, totalPages: 5 } });
        }
        if (url.startsWith("/api/v1/bundles")) {
          return ok({ data: [], pagination: { page: 1, limit: 100, total: 0, totalPages: 0 } });
        }
        if (url.startsWith("/api/v1/analytics/overview")) {
          return ok({ totalRevenue: 1234.5, totalOrders: 42, topBundles: [] });
        }
        if (url.startsWith("/api/v1/inventory/health")) {
          return ok({ shopId: "s1", counts: { synced: 10, pending: 1, error: 0, locked: 0 } });
        }
        if (url.startsWith("/api/v1/orders")) {
          return ok({ data: [] });
        }
        if (url.startsWith("/api/v1/ai/suggested-bundles")) {
          return ok({ pairs: [], totalBaskets: 0 });
        }
        if (url.startsWith("/api/v1/activity")) {
          return ok({ data: [] });
        }
        return ok({});
      }),
    );
    renderPage();
    // Wait for fetches to resolve and the seven cards to render.
    await waitFor(() => {
      expect(screen.getByText(/Revenue snapshot/i)).toBeInTheDocument();
    });
    expect(screen.getByText(/Bundle status/i)).toBeInTheDocument();
    expect(screen.getByText(/Recent bundles/i)).toBeInTheDocument();
    expect(screen.getByText(/Inventory health/i)).toBeInTheDocument();
    expect(screen.getByText(/Recent orders/i)).toBeInTheDocument();
    expect(screen.getByText(/AI bundle suggestions/i)).toBeInTheDocument();
    expect(screen.getByText(/Recent activity/i)).toBeInTheDocument();
  });

  it("isolates one widget's failure from the others", async () => {
    vi.stubGlobal(
      "fetch",
      mockFetch((url) => {
        if (url.startsWith("/api/v1/bundles?limit=1")) {
          return ok({ data: [], pagination: { page: 1, limit: 1, total: 5, totalPages: 5 } });
        }
        if (url.startsWith("/api/v1/inventory/health")) {
          return fail(500);
        }
        if (url.startsWith("/api/v1/bundles")) {
          return ok({ data: [], pagination: { page: 1, limit: 100, total: 0, totalPages: 0 } });
        }
        return ok({
          totalRevenue: 0,
          totalOrders: 0,
          topBundles: [],
          data: [],
          pairs: [],
          totalBaskets: 0,
        });
      }),
    );
    renderPage();
    // Inventory widget shows error, the other widgets still render their titles.
    await waitFor(() => {
      expect(screen.getByText(/Revenue snapshot/i)).toBeInTheDocument();
    });
    await waitFor(() => {
      expect(screen.getByText(/Couldn't load: HTTP 500/i)).toBeInTheDocument();
    });
    // Other widgets are still present.
    expect(screen.getByText(/Recent activity/i)).toBeInTheDocument();
  });
});
