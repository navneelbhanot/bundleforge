import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { AppProvider } from "@shopify/polaris";

import { SettingsSidebar } from "./SettingsSidebar";

const i18n = { Polaris: { Common: { cancel: "Cancel", save: "Save" } } };

const TABS = [
  { id: "general", content: "General" },
  { id: "display", content: "Display" },
  { id: "inventory", content: "Inventory" },
] as const;

afterEach(cleanup);

describe("SettingsSidebar (M-185)", () => {
  it("renders one button per tab", () => {
    render(
      <AppProvider i18n={i18n}>
        <SettingsSidebar tabs={TABS} activeIndex={0} onSelect={vi.fn()} />
      </AppProvider>,
    );
    expect(screen.getByRole("button", { name: "General" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Display" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Inventory" })).toBeTruthy();
  });

  it("calls onSelect with the index when a button is clicked", () => {
    const onSelect = vi.fn();
    render(
      <AppProvider i18n={i18n}>
        <SettingsSidebar tabs={TABS} activeIndex={0} onSelect={onSelect} />
      </AppProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Display" }));
    expect(onSelect).toHaveBeenCalledWith(1);
  });

  it("marks the active button distinctly", () => {
    render(
      <AppProvider i18n={i18n}>
        <SettingsSidebar tabs={TABS} activeIndex={2} onSelect={vi.fn()} />
      </AppProvider>,
    );
    // Polaris primary buttons get a different class than tertiary; the
    // exact class depends on Polaris internals, so assert structurally
    // by mounting a control sample and comparing className shapes.
    const inventory = screen.getByRole("button", { name: "Inventory" });
    const general = screen.getByRole("button", { name: "General" });
    expect(inventory.className).not.toEqual(general.className);
  });
});
