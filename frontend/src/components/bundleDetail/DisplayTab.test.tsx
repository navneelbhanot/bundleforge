import { describe, it, expect, afterEach, vi } from "vitest";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  cleanup,
} from "@testing-library/react";
import { AppProvider } from "@shopify/polaris";

import {
  DisplayTab,
  type DisplaySettings,
  type ShopDisplayDefaults,
} from "./DisplayTab";

const i18n = { Polaris: { Common: { cancel: "Cancel", save: "Save" } } };

function wrap(node: React.ReactNode) {
  return <AppProvider i18n={i18n}>{node}</AppProvider>;
}

function renderTab(
  overrides: Partial<{
    bundleDisplay: DisplaySettings;
    shopDefaults: ShopDisplayDefaults;
    onSave: (patch: { displaySettings: Record<string, string | null> }) => Promise<void>;
  }> = {},
) {
  const onSave = overrides.onSave ?? vi.fn().mockResolvedValue(undefined);
  return {
    onSave,
    ...render(
      wrap(
        <DisplayTab
          bundleDisplay={overrides.bundleDisplay ?? {}}
          shopDefaults={overrides.shopDefaults ?? {}}
          busy={false}
          onSave={onSave}
        />,
      ),
    ),
  };
}

afterEach(() => {
  cleanup();
});

describe("DisplayTab", () => {
  it("renders Layout / Imagery / Custom CSS headings", () => {
    renderTab();
    expect(
      screen.getByRole("heading", { name: "Layout & visual style", level: 2 }),
    ).toBeTruthy();
    expect(
      screen.getByRole("heading", { name: "Imagery & copy", level: 2 }),
    ).toBeTruthy();
    expect(
      screen.getByRole("heading", { name: "Custom CSS", level: 2 }),
    ).toBeTruthy();
  });

  it("Layout save sends the chosen layout value", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const { container } = renderTab({ onSave });
    // Layout select defaults to USE_SHOP — find by current value.
    const selects = Array.from(container.querySelectorAll("select"));
    const layoutSelect = selects.find((s) => s.value === "__use_shop__")!;
    expect(layoutSelect).toBeTruthy();
    fireEvent.change(layoutSelect, { target: { value: "list" } });
    const saveBtn = (
      Array.from(container.querySelectorAll("button")) as HTMLButtonElement[]
    ).find((b) => b.textContent?.trim() === "Save layout")!;
    saveBtn.click();
    await waitFor(() => expect(onSave).toHaveBeenCalled());
    const payload = onSave.mock.calls[0][0];
    expect(payload.displaySettings.layout).toBe("list");
  });

  it("'Use shop default' on a previously-overridden field sends null", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const { container } = renderTab({
      bundleDisplay: { layout: "carousel" },
      onSave,
    });
    // Layout select starts on "carousel"; flip back to USE_SHOP.
    const layoutSelect = Array.from(
      container.querySelectorAll<HTMLSelectElement>("select"),
    ).find((s) => s.value === "carousel")!;
    fireEvent.change(layoutSelect, { target: { value: "__use_shop__" } });
    const saveBtn = (
      Array.from(container.querySelectorAll("button")) as HTMLButtonElement[]
    ).find((b) => b.textContent?.trim() === "Save layout")!;
    saveBtn.click();
    await waitFor(() => expect(onSave).toHaveBeenCalled());
    const payload = onSave.mock.calls[0][0];
    expect(payload.displaySettings.layout).toBeNull();
  });

  it("Custom CSS card flags mismatched braces", async () => {
    const { container } = renderTab();
    const textarea = container.querySelector(
      "textarea",
    ) as HTMLTextAreaElement | null;
    expect(textarea).toBeTruthy();
    fireEvent.change(textarea!, {
      target: { value: ".bf-bundle { color: red;" },
    });
    await waitFor(() =>
      expect(
        screen.getByRole("heading", { name: "Mismatched braces" }),
      ).toBeTruthy(),
    );
  });

  it("Layout helpText surfaces what the merchant inherits from the shop", () => {
    renderTab({
      shopDefaults: { layout: "carousel", colorPreset: "high-contrast" },
    });
    expect(
      screen.getByText(/Inheriting "carousel" from shop default layout/i),
    ).toBeTruthy();
  });
});
