import { describe, it, expect, afterEach, vi } from "vitest";
import {
  render,
  screen,
  waitFor,
  cleanup,
} from "@testing-library/react";
import { AppProvider } from "@shopify/polaris";

import {
  HelpDrawer,
  MarkdownView,
  OPEN_HELP_EVENT,
} from "./HelpDrawer";

const i18n = { Polaris: { Common: { cancel: "Cancel", save: "Save" } } };

function wrap(node: React.ReactNode) {
  return <AppProvider i18n={i18n}>{node}</AppProvider>;
}

const ARTICLES = [
  { id: "getting-started", title: "Getting started", category: "Getting started" },
  { id: "pricing", title: "Pricing", category: "Bundles" },
];

afterEach(() => {
  cleanup();
});

describe("HelpDrawer", () => {
  it("lazy-fetches the article list on first open", async () => {
    const list = vi.fn().mockResolvedValue({ data: ARTICLES });
    const get = vi.fn();
    render(
      wrap(
        <HelpDrawer
          fetcher={{ list, get }}
          initialOpen
        />,
      ),
    );
    await waitFor(() => expect(list).toHaveBeenCalled());
    // "Getting started" appears as both a category heading and
    // an article title — use getAllByText.
    await waitFor(() =>
      expect(screen.getAllByText("Getting started").length).toBeGreaterThan(0),
    );
    expect(screen.getByText("Pricing")).toBeTruthy();
  });

  it("clicking an article fetches and renders its body", async () => {
    const list = vi.fn().mockResolvedValue({ data: ARTICLES });
    const get = vi.fn().mockResolvedValue({
      id: "pricing",
      title: "Pricing",
      category: "Bundles",
      body: "# Pricing\n\nHello world.",
    });
    render(
      wrap(<HelpDrawer fetcher={{ list, get }} initialOpen />),
    );
    await waitFor(() => expect(list).toHaveBeenCalled());

    // Click the article button.
    const buttons = (
      Array.from(document.querySelectorAll("button")) as HTMLButtonElement[]
    ).filter((b) => b.textContent?.trim() === "Pricing");
    expect(buttons.length).toBeGreaterThan(0);
    buttons[0].click();

    await waitFor(() => expect(get).toHaveBeenCalledWith("pricing"));
    await waitFor(() =>
      expect(screen.getByText("Hello world.")).toBeTruthy(),
    );
  });

  it("opens via the bundleforge:open-help window event", async () => {
    const list = vi.fn().mockResolvedValue({ data: ARTICLES });
    const get = vi.fn();
    render(<AppProvider i18n={i18n}><HelpDrawer fetcher={{ list, get }} /></AppProvider>);

    // Modal is closed initially.
    expect(screen.queryByText("Getting started")).toBeNull();

    // Dispatch the event.
    window.dispatchEvent(new CustomEvent(OPEN_HELP_EVENT));

    // List fetch fires + article appears.
    await waitFor(() => expect(list).toHaveBeenCalled());
    await waitFor(() =>
      expect(
        screen.getAllByText("Getting started").length,
      ).toBeGreaterThan(0),
    );
  });
});

describe("MarkdownView (security: javascript: URLs)", () => {
  it("renders a [text](https://...) link as an <a>", () => {
    const { container } = render(
      wrap(<MarkdownView body="See [Shopify](https://shopify.com)." />),
    );
    const link = container.querySelector("a");
    expect(link).toBeTruthy();
    expect(link?.getAttribute("href")).toBe("https://shopify.com");
  });

  it("strips javascript: URLs and renders the link text as plain text", () => {
    const { container } = render(
      wrap(
        <MarkdownView
          body="Click [me](javascript:alert('xss')) for a surprise."
        />,
      ),
    );
    // The text "me" still appears, but no <a> tag is rendered.
    expect(container.textContent).toContain("me");
    expect(container.querySelectorAll("a")).toHaveLength(0);
  });

  it("renders **bold** and `inline code`", () => {
    const { container } = render(
      wrap(
        <MarkdownView body="Use **strong** terms and `code` snippets." />,
      ),
    );
    expect(container.querySelector("strong")?.textContent).toBe("strong");
    expect(container.querySelector("code")?.textContent).toBe("code");
  });
});
