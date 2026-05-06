import { describe, it, expect, afterEach, vi } from "vitest";
import {
  render,
  screen,
  waitFor,
  cleanup,
} from "@testing-library/react";
import { AppProvider } from "@shopify/polaris";

import { TemplatesModal, type BundleTemplate } from "./TemplatesModal";

const i18n = { Polaris: { Common: { cancel: "Cancel", save: "Save" } } };

function wrap(node: React.ReactNode) {
  return <AppProvider i18n={i18n}>{node}</AppProvider>;
}

const TEMPLATES: BundleTemplate[] = [
  {
    id: "holiday-gift-box",
    label: "Holiday gift box",
    description: "Curated 3-product seasonal gift set with 15% off.",
    category: "seasonal",
    type: "fixed",
    defaultTitle: "Holiday gift box",
  },
  {
    id: "bogo-weekender",
    label: "BOGO weekender",
    description: "Buy-one-get-one-free promo.",
    category: "promo",
    type: "bogo",
    defaultTitle: "Buy one, get one free",
  },
  {
    id: "subscription-starter",
    label: "Subscription starter",
    description: "Recurring-bundle scaffold for Recharge.",
    category: "subscription",
    type: "subscription",
    defaultTitle: "Monthly subscription bundle",
  },
];

afterEach(() => {
  cleanup();
});

describe("TemplatesModal", () => {
  it("renders one card per template", () => {
    render(
      wrap(
        <TemplatesModal
          open
          templates={TEMPLATES}
          busy={false}
          onUseTemplate={vi.fn()}
          onClose={vi.fn()}
        />,
      ),
    );
    expect(
      screen.getByRole("heading", { name: "Holiday gift box" }),
    ).toBeTruthy();
    expect(
      screen.getByRole("heading", { name: "BOGO weekender" }),
    ).toBeTruthy();
    expect(
      screen.getByRole("heading", { name: "Subscription starter" }),
    ).toBeTruthy();
  });

  it("clicking a 'Use this template' button calls onUseTemplate(id)", async () => {
    const onUseTemplate = vi.fn().mockResolvedValue(undefined);
    render(
      wrap(
        <TemplatesModal
          open
          templates={TEMPLATES}
          busy={false}
          onUseTemplate={onUseTemplate}
          onClose={vi.fn()}
        />,
      ),
    );
    // The first "Use this template" button corresponds to the
    // first template card.
    const buttons = (
      Array.from(document.querySelectorAll("button")) as HTMLButtonElement[]
    ).filter((b) => b.textContent?.trim() === "Use this template");
    expect(buttons.length).toBe(TEMPLATES.length);
    buttons[1].click();
    await waitFor(() =>
      expect(onUseTemplate).toHaveBeenCalledWith("bogo-weekender"),
    );
  });

  it("renders nothing user-visible when open=false", () => {
    render(
      wrap(
        <TemplatesModal
          open={false}
          templates={TEMPLATES}
          busy={false}
          onUseTemplate={vi.fn()}
          onClose={vi.fn()}
        />,
      ),
    );
    expect(
      screen.queryByRole("heading", { name: "Holiday gift box" }),
    ).toBeNull();
  });
});
