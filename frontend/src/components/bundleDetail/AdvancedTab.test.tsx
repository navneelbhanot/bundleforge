import { describe, it, expect, afterEach, vi } from "vitest";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  cleanup,
} from "@testing-library/react";
import { AppProvider } from "@shopify/polaris";

import { AdvancedTab } from "./AdvancedTab";

const i18n = { Polaris: { Common: { cancel: "Cancel", save: "Save" } } };

function wrap(node: React.ReactNode) {
  return <AppProvider i18n={i18n}>{node}</AppProvider>;
}

function renderTab(
  overrides: Partial<{
    initialSeoTitle: string | null;
    initialSeoDescription: string | null;
    onSave: (
      patch: { seoTitle: string | null; seoDescription: string | null },
    ) => Promise<void>;
    onDuplicate: () => Promise<void>;
    onDelete: () => Promise<void>;
  }> = {},
) {
  const onSave = overrides.onSave ?? vi.fn().mockResolvedValue(undefined);
  const onDuplicate =
    overrides.onDuplicate ?? vi.fn().mockResolvedValue(undefined);
  const onDelete = overrides.onDelete ?? vi.fn().mockResolvedValue(undefined);
  return {
    onSave,
    onDuplicate,
    onDelete,
    ...render(
      wrap(
        <AdvancedTab
          bundleId="b-1"
          initialSeoTitle={overrides.initialSeoTitle ?? null}
          initialSeoDescription={overrides.initialSeoDescription ?? null}
          rawConfig={{
            config: { foo: "bar" },
            displaySettings: { layout: "grid" },
            scheduleSettings: {},
            eligibility: {},
            inventoryRules: {},
          }}
          busy={false}
          onSave={onSave}
          onDuplicate={onDuplicate}
          onDelete={onDelete}
        />,
      ),
    ),
  };
}

afterEach(() => {
  cleanup();
});

describe("AdvancedTab", () => {
  it("renders Search engine listing / Raw configuration / Danger zone headings", () => {
    renderTab();
    expect(
      screen.getByRole("heading", {
        name: "Search engine listing",
        level: 2,
      }),
    ).toBeTruthy();
    expect(
      screen.getByRole("heading", { name: "Raw configuration", level: 2 }),
    ).toBeTruthy();
    expect(
      screen.getByRole("heading", { name: "Danger zone", level: 2 }),
    ).toBeTruthy();
  });

  it("Editing SEO title + Save sends the patch", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const { container } = renderTab({ onSave });
    const titleInput = container.querySelector(
      'input[autocomplete="off"]',
    ) as HTMLInputElement;
    expect(titleInput).toBeTruthy();
    fireEvent.change(titleInput, { target: { value: "Holiday Pack 2026" } });

    const saveBtn = (
      Array.from(container.querySelectorAll("button")) as HTMLButtonElement[]
    ).find((b) => b.textContent?.trim() === "Save SEO")!;
    saveBtn.click();
    await waitFor(() => expect(onSave).toHaveBeenCalled());
    const payload = onSave.mock.calls[0][0];
    expect(payload.seoTitle).toBe("Holiday Pack 2026");
  });

  it("Clicking Duplicate fires onDuplicate", async () => {
    const onDuplicate = vi.fn().mockResolvedValue(undefined);
    const { container } = renderTab({ onDuplicate });
    const dupBtn = (
      Array.from(container.querySelectorAll("button")) as HTMLButtonElement[]
    ).find((b) => b.textContent?.trim() === "Duplicate this bundle")!;
    dupBtn.click();
    await waitFor(() => expect(onDuplicate).toHaveBeenCalled());
  });

  it("Clicking Delete + typing DELETE + confirm fires onDelete", async () => {
    const onDelete = vi.fn().mockResolvedValue(undefined);
    const { container } = renderTab({ onDelete });

    const delBtn = (
      Array.from(container.querySelectorAll("button")) as HTMLButtonElement[]
    ).find((b) => b.textContent?.trim() === "Delete this bundle")!;
    delBtn.click();

    // Wait for the modal to mount.
    await waitFor(() =>
      expect(screen.getByText(/Type DELETE to confirm/i)).toBeTruthy(),
    );

    // Modal renders into a portal — use document-wide queries.
    const confirmInput = document.querySelector(
      'input[type="text"][autocomplete="off"]',
    ) as HTMLInputElement | null;
    // There may be multiple text inputs; pick the one labeled
    // "Type DELETE to confirm" by walking from the label text.
    const allInputs = Array.from(
      document.querySelectorAll<HTMLInputElement>("input"),
    );
    const targetInput =
      allInputs.find(
        (i) =>
          i.getAttribute("aria-labelledby") &&
          (
            document.getElementById(
              i.getAttribute("aria-labelledby") as string,
            )?.textContent ?? ""
          )
            .toLowerCase()
            .includes("delete"),
      ) ?? confirmInput;
    expect(targetInput).toBeTruthy();
    fireEvent.change(targetInput!, { target: { value: "DELETE" } });

    const modalDeleteBtn = Array.from(
      document.querySelectorAll<HTMLButtonElement>("button"),
    ).find((b) => b.textContent?.trim() === "Delete" && !b.disabled);
    expect(modalDeleteBtn).toBeTruthy();
    modalDeleteBtn!.click();
    await waitFor(() => expect(onDelete).toHaveBeenCalled());
  });
});
