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
    // The active item carries an inset box-shadow accent stripe and
    // a tinted background; the inactive items render with transparent
    // background and no shadow. Check the inline style attribute.
    const inventory = screen.getByRole("button", { name: /Inventory/i });
    const general = screen.getByRole("button", { name: /General/i });
    expect(inventory.getAttribute("style")).not.toEqual(
      general.getAttribute("style"),
    );
    expect(inventory.getAttribute("style")).toMatch(/inset 3px 0 0/);
    expect(general.getAttribute("style")).not.toMatch(/inset 3px 0 0/);
  });
});
