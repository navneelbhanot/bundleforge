import { describe, it, expect, vi, afterEach } from "vitest";
import { render, cleanup, within } from "@testing-library/react";
import { AppProvider } from "@shopify/polaris";
import enTranslations from "@shopify/polaris/locales/en.json";

import { OrderCapBanner, type OrderCapBannerStatus } from "./OrderCapBanner";

afterEach(() => {
  // Polaris portals occasionally leak between tests; explicit
  // cleanup keeps `within(container)` queries deterministic.
  cleanup();
});

function renderWithPolaris(ui: React.ReactElement): ReturnType<typeof render> {
  return render(<AppProvider i18n={enTranslations}>{ui}</AppProvider>);
}

function bannerNotPresent(container: HTMLElement): boolean {
  // Banner is the only thing this component renders; absence of any
  // button-with-CTA-text means we're rendering null. The Polaris
  // AppProvider always wraps in a PolarisPortalsContainer div, so
  // checking container.firstChild for null doesn't work.
  return (
    within(container).queryByRole("button", { name: /Upgrade to Growth/i }) ===
    null
  );
}

describe("OrderCapBanner", () => {
  it("renders nothing when status is null", () => {
    const { container } = renderWithPolaris(<OrderCapBanner status={null} />);
    expect(bannerNotPresent(container)).toBe(true);
  });

  it("renders nothing on a paid plan (cap=null)", () => {
    const status: OrderCapBannerStatus = {
      plan: "growth",
      cap: null,
      count: 50_000,
      over: false,
      approaching: false,
    };
    const { container } = renderWithPolaris(<OrderCapBanner status={status} />);
    expect(bannerNotPresent(container)).toBe(true);
  });

  it("renders nothing under the 80% threshold", () => {
    const status: OrderCapBannerStatus = {
      plan: "starter",
      cap: 100,
      count: 79,
      over: false,
      approaching: false,
    };
    const { container } = renderWithPolaris(<OrderCapBanner status={status} />);
    expect(bannerNotPresent(container)).toBe(true);
  });

  it("renders a warning banner when approaching the cap", () => {
    const status: OrderCapBannerStatus = {
      plan: "starter",
      cap: 100,
      count: 80,
      over: false,
      approaching: true,
    };
    const { container } = renderWithPolaris(<OrderCapBanner status={status} />);
    expect(
      within(container).getByText(/used 80 of 100 monthly bundle orders/i),
    ).toBeTruthy();
    expect(
      within(container).getByRole("button", { name: /Upgrade to Growth/i }),
    ).toBeTruthy();
  });

  it("renders a critical banner when over the cap", () => {
    const status: OrderCapBannerStatus = {
      plan: "starter",
      cap: 100,
      count: 100,
      over: true,
      approaching: false,
    };
    const { container } = renderWithPolaris(<OrderCapBanner status={status} />);
    expect(
      within(container).getByText(/reached your Starter monthly order limit/i),
    ).toBeTruthy();
    expect(
      within(container).getByText(/new bundle checkouts are blocked/i),
    ).toBeTruthy();
    expect(
      within(container).getByRole("button", { name: /Upgrade to Growth/i }),
    ).toBeTruthy();
  });

  it("invokes onUpgrade when the upgrade action is clicked", () => {
    const status: OrderCapBannerStatus = {
      plan: "starter",
      cap: 100,
      count: 90,
      over: false,
      approaching: true,
    };
    const onUpgrade = vi.fn();
    const { container } = renderWithPolaris(
      <OrderCapBanner status={status} onUpgrade={onUpgrade} />,
    );
    const button = within(container).getByRole("button", {
      name: /Upgrade to Growth/i,
    });
    button.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(onUpgrade).toHaveBeenCalledTimes(1);
  });
});
