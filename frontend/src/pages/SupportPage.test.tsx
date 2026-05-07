import { describe, it, expect, vi, afterEach } from "vitest";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  cleanup,
} from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { AppProvider } from "@shopify/polaris";

import { SupportPage } from "./SupportPage";

const i18n = { Polaris: { Common: { cancel: "Cancel", save: "Save" } } };

const ARTICLES = [
  { id: "getting-started", title: "Getting started", category: "Getting started" },
  { id: "bundle-types", title: "Bundle types overview", category: "Bundles" },
  { id: "pricing", title: "Pricing rules", category: "Bundles" },
  { id: "inventory", title: "Inventory and stock", category: "Operations" },
];

function makeFetcher() {
  return {
    list: vi.fn().mockResolvedValue({ data: ARTICLES }),
    get: vi.fn((id: string) =>
      Promise.resolve({
        id,
        title: ARTICLES.find((a) => a.id === id)?.title ?? id,
        category: "test",
        body: `# ${id}\n\nBody for **${id}**.`,
      }),
    ),
  };
}

function renderPage(initialUrl = "/support") {
  return render(
    <AppProvider i18n={i18n}>
      <MemoryRouter initialEntries={[initialUrl]}>
        <Routes>
          <Route path="/support" element={<SupportPage fetcher={makeFetcher()} />} />
        </Routes>
      </MemoryRouter>
    </AppProvider>,
  );
}

afterEach(cleanup);

describe("SupportPage (M-187)", () => {
  it("renders the article list with category headings", async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("Getting started", { selector: "button" })).toBeTruthy();
    });
    expect(screen.getByText("Bundle types overview")).toBeTruthy();
    expect(screen.getByText("Pricing rules")).toBeTruthy();
    expect(screen.getByText("Inventory and stock")).toBeTruthy();
  });

  it("filters the article list by title (case-insensitive)", async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("Bundle types overview")).toBeTruthy();
    });
    const search = screen.getByPlaceholderText(/Search help articles/i);
    fireEvent.change(search, { target: { value: "Pric" } });
    expect(screen.getByText("Pricing rules")).toBeTruthy();
    expect(screen.queryByText("Inventory and stock")).toBeNull();
  });

  it("auto-selects the first article on load and renders its body", async () => {
    renderPage();
    await waitFor(() => {
      // The active article's rendered body shows up as a heading.
      expect(screen.getAllByText(/getting-started/i).length).toBeGreaterThan(0);
    });
  });

  it("renders the contact card with an email mailto link", async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByText(/Talk to us/i)).toBeTruthy();
    });
    const email = screen.getByRole("link", { name: /Email/i });
    expect(email.getAttribute("href")).toMatch(/^mailto:/);
  });

  it("hides the Resources card when no env links are set", async () => {
    renderPage();
    // Wait for the page to fully render (Talk-to-us card is in the
    // sidebar so it's a reliable signal).
    await waitFor(() => {
      expect(screen.getByText(/Talk to us/i)).toBeTruthy();
    });
    // No env vars in jsdom → the Resources card never mounts, so
    // its heading isn't in the document.
    expect(screen.queryByText(/^Resources$/i)).toBeNull();
  });
});
