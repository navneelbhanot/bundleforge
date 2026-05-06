import { describe, it, expect, afterEach, vi } from "vitest";
import {
  render,
  screen,
  cleanup,
} from "@testing-library/react";
import { AppProvider } from "@shopify/polaris";

import { EmptyStateCard } from "./EmptyStateCard";

const i18n = { Polaris: { Common: { cancel: "Cancel", save: "Save" } } };

function wrap(node: React.ReactNode) {
  return <AppProvider i18n={i18n}>{node}</AppProvider>;
}

afterEach(() => {
  cleanup();
});

describe("EmptyStateCard (M-183)", () => {
  it("renders the heading and primary-action button", () => {
    render(
      wrap(
        <EmptyStateCard
          heading="No bundle orders yet"
          body="Orders show up here after the first checkout."
          primaryAction={{ content: "Create a bundle", url: "/bundles/new" }}
        />,
      ),
    );
    expect(screen.getByText("No bundle orders yet")).toBeTruthy();
    expect(
      screen.getByText("Orders show up here after the first checkout."),
    ).toBeTruthy();
    const cta = (
      Array.from(document.querySelectorAll("button, a")) as HTMLElement[]
    ).find((b) => b.textContent?.trim() === "Create a bundle");
    expect(cta).toBeTruthy();
  });

  it("resolves a known illustration to a non-empty <img> src", () => {
    const { container } = render(
      wrap(
        <EmptyStateCard
          illustration="orders"
          heading="No orders"
          primaryAction={{
            content: "Create a bundle",
            onAction: vi.fn(),
          }}
        />,
      ),
    );
    const img = container.querySelector("img");
    expect(img).toBeTruthy();
    expect(img!.getAttribute("src")?.startsWith("data:image/svg+xml")).toBe(
      true,
    );
  });

  it("falls back to no illustration when none is provided", () => {
    const { container } = render(
      wrap(
        <EmptyStateCard
          heading="Nothing here"
          primaryAction={{ content: "Go", onAction: vi.fn() }}
        />,
      ),
    );
    const img = container.querySelector("img");
    // Polaris EmptyState may still render an <img> even with empty
    // src; assert it has no data-URI or is missing.
    if (img) {
      const src = img.getAttribute("src") ?? "";
      expect(src.startsWith("data:image/svg+xml")).toBe(false);
    }
  });
});
