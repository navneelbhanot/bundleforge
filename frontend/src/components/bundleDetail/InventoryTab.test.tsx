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
  InventoryTab,
  type InventoryRules,
  type ShopInventoryDefaults,
} from "./InventoryTab";

const i18n = { Polaris: { Common: { cancel: "Cancel", save: "Save" } } };

function wrap(node: React.ReactNode) {
  return <AppProvider i18n={i18n}>{node}</AppProvider>;
}

function renderTab(
  overrides: Partial<{
    inventoryRules: InventoryRules;
    shopDefaults: ShopInventoryDefaults;
    onSave: (patch: { inventoryRules: Record<string, unknown> }) => Promise<void>;
  }> = {},
) {
  const onSave = overrides.onSave ?? vi.fn().mockResolvedValue(undefined);
  return {
    onSave,
    ...render(
      wrap(
        <InventoryTab
          inventoryRules={overrides.inventoryRules ?? {}}
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

describe("InventoryTab", () => {
  it("renders Low-stock thresholds / Oversell policy / Bundle rendering mode headings", () => {
    renderTab();
    expect(
      screen.getByRole("heading", {
        name: "Low-stock thresholds",
        level: 2,
      }),
    ).toBeTruthy();
    expect(
      screen.getByRole("heading", { name: "Oversell policy", level: 2 }),
    ).toBeTruthy();
    expect(
      screen.getByRole("heading", {
        name: "Bundle rendering mode",
        level: 2,
      }),
    ).toBeTruthy();
  });

  it("Editing lowStockThreshold + Save sends the int", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const { container } = renderTab({ onSave });

    const lowStock = Array.from(
      container.querySelectorAll<HTMLInputElement>('input[type="number"]'),
    )[0];
    expect(lowStock).toBeTruthy();
    fireEvent.change(lowStock, { target: { value: "8" } });

    const saveBtn = (
      Array.from(container.querySelectorAll("button")) as HTMLButtonElement[]
    ).find((b) => b.textContent?.trim() === "Save thresholds")!;
    saveBtn.click();
    await waitFor(() => expect(onSave).toHaveBeenCalled());
    const payload = onSave.mock.calls[0][0];
    expect(payload.inventoryRules.lowStockThreshold).toBe(8);
  });

  it("Switching oversellPolicy + Save sends the new enum", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const { container } = renderTab({ onSave });

    const select = container.querySelector("select") as HTMLSelectElement;
    expect(select).toBeTruthy();
    fireEvent.change(select, { target: { value: "prevent" } });

    const saveBtn = (
      Array.from(container.querySelectorAll("button")) as HTMLButtonElement[]
    ).find((b) => b.textContent?.trim() === "Save policy")!;
    saveBtn.click();
    await waitFor(() => expect(onSave).toHaveBeenCalled());
    const payload = onSave.mock.calls[0][0];
    expect(payload.inventoryRules.oversellPolicy).toBe("prevent");
  });

  it("Toggling componentOnlyMode + Save sends true", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const { container } = renderTab({ onSave });

    // The componentOnlyMode checkbox lives in the third card. Pick
    // by its label text since there's only one checkbox with that
    // wording.
    const checkboxes = Array.from(
      container.querySelectorAll<HTMLInputElement>('input[type="checkbox"]'),
    );
    // Two checkboxes: low-stock alert (card 1) + component-only (card 3).
    // Component-only is the second one rendered.
    const componentOnly = checkboxes[checkboxes.length - 1];
    expect(componentOnly).toBeTruthy();
    fireEvent.click(componentOnly);

    const saveBtn = (
      Array.from(container.querySelectorAll("button")) as HTMLButtonElement[]
    ).find((b) => b.textContent?.trim() === "Save mode")!;
    saveBtn.click();
    await waitFor(() => expect(onSave).toHaveBeenCalled());
    const payload = onSave.mock.calls[0][0];
    expect(payload.inventoryRules.componentOnlyMode).toBe(true);
  });
});
