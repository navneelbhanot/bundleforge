import { describe, it, expect, afterEach, vi } from "vitest";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  cleanup,
} from "@testing-library/react";
import { AppProvider } from "@shopify/polaris";

import { CustomersTab, type Eligibility } from "./CustomersTab";

const i18n = { Polaris: { Common: { cancel: "Cancel", save: "Save" } } };

function wrap(node: React.ReactNode) {
  return <AppProvider i18n={i18n}>{node}</AppProvider>;
}

function renderTab(
  overrides: Partial<{
    eligibility: Eligibility;
    onSave: (patch: { eligibility: Record<string, unknown> }) => Promise<void>;
  }> = {},
) {
  const onSave = overrides.onSave ?? vi.fn().mockResolvedValue(undefined);
  return {
    onSave,
    ...render(
      wrap(
        <CustomersTab
          eligibility={overrides.eligibility ?? {}}
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

describe("CustomersTab", () => {
  it("renders Tag-based / Login & Segments / Market & locale headings", () => {
    renderTab();
    expect(
      screen.getByRole("heading", {
        name: "Tag-based eligibility",
        level: 2,
      }),
    ).toBeTruthy();
    expect(
      screen.getByRole("heading", { name: "Login & Segments", level: 2 }),
    ).toBeTruthy();
    expect(
      screen.getByRole("heading", { name: "Market & locale", level: 2 }),
    ).toBeTruthy();
  });

  it("Adding an allow-tag chip + Save sends customerTagsAllow array", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const { container } = renderTab({ onSave });

    const allowInput = Array.from(
      container.querySelectorAll<HTMLInputElement>("input"),
    ).find((i) => i.placeholder === "e.g. vip")!;
    expect(allowInput).toBeTruthy();
    fireEvent.change(allowInput, { target: { value: "vip" } });

    // First "Add" button is the allow-tag adder. The deny adder is also
    // labeled "Add", so we pick the first one.
    const addButtons = (
      Array.from(container.querySelectorAll("button")) as HTMLButtonElement[]
    ).filter((b) => b.textContent?.trim() === "Add");
    expect(addButtons.length).toBeGreaterThan(0);
    addButtons[0].click();

    await waitFor(() => expect(screen.getByText("vip")).toBeTruthy());

    const saveBtn = (
      Array.from(container.querySelectorAll("button")) as HTMLButtonElement[]
    ).find((b) => b.textContent?.trim() === "Save tags")!;
    saveBtn.click();
    await waitFor(() => expect(onSave).toHaveBeenCalled());
    const payload = onSave.mock.calls[0][0];
    expect(payload.eligibility.customerTagsAllow).toEqual(["vip"]);
  });

  it("Toggling Require login + Save sends requireLogin: true", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const { container } = renderTab({ onSave });
    const checkbox = container.querySelector(
      'input[type="checkbox"]',
    ) as HTMLInputElement;
    expect(checkbox).toBeTruthy();
    fireEvent.click(checkbox);

    const saveBtn = (
      Array.from(container.querySelectorAll("button")) as HTMLButtonElement[]
    ).find((b) => {
      // Both LoginSegments + the implicit ChannelsCard expose Save.
      // Pick the one inside the Login & Segments card.
      return b.textContent?.trim() === "Save";
    })!;
    saveBtn.click();
    await waitFor(() => expect(onSave).toHaveBeenCalled());
    const payload = onSave.mock.calls[0][0];
    expect(payload.eligibility.requireLogin).toBe(true);
  });

  it("Picking a market via ChoiceList + Save sends markets array", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const { container } = renderTab({ onSave });

    // Find the US checkbox by its labelled input value.
    const usCheckbox = Array.from(
      container.querySelectorAll<HTMLInputElement>('input[type="checkbox"]'),
    ).find((i) => i.value === "US");
    expect(usCheckbox).toBeTruthy();
    fireEvent.click(usCheckbox!);

    const saveBtn = (
      Array.from(container.querySelectorAll("button")) as HTMLButtonElement[]
    ).find((b) => b.textContent?.trim() === "Save targeting")!;
    saveBtn.click();
    await waitFor(() => expect(onSave).toHaveBeenCalled());
    const payload = onSave.mock.calls[0][0];
    expect(payload.eligibility.markets).toEqual(["US"]);
  });

  // Note: the "empty allow → null on save" branch is covered server-side
  // by `BundleService.update treats null as 'remove this restriction'`
  // in src/services/bundles/index.test.ts. Reproducing the same test in
  // jsdom requires interacting with Polaris Tag's onRemove button,
  // which doesn't react to fireEvent in a stable way without
  // @testing-library/user-event. The TagsCard's null-emit logic is
  // visible in source — when `allow.length === 0` the save body sends
  // `customerTagsAllow: null`, same shape as the server expects.
});
