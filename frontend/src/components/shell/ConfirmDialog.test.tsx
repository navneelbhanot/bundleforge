import { describe, it, expect, afterEach, vi } from "vitest";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  cleanup,
} from "@testing-library/react";
import { AppProvider } from "@shopify/polaris";

import { ConfirmDialog } from "./ConfirmDialog";

const i18n = { Polaris: { Common: { cancel: "Cancel", save: "Save" } } };

function wrap(node: React.ReactNode) {
  return <AppProvider i18n={i18n}>{node}</AppProvider>;
}

afterEach(() => {
  cleanup();
});

describe("ConfirmDialog", () => {
  it("renders the title + body when open", () => {
    render(
      wrap(
        <ConfirmDialog
          open
          title="Delete this bundle?"
          body="The bundle is hidden from the storefront."
          onConfirm={vi.fn()}
          onCancel={vi.fn()}
        />,
      ),
    );
    // Polaris Modal title renders as an h2 in the header.
    expect(
      screen.getByRole("heading", { name: "Delete this bundle?" }),
    ).toBeTruthy();
    expect(
      screen.getByText("The bundle is hidden from the storefront."),
    ).toBeTruthy();
  });

  it("primary button calls onConfirm", async () => {
    const onConfirm = vi.fn().mockResolvedValue(undefined);
    render(
      wrap(
        <ConfirmDialog
          open
          title="Confirm?"
          body="Are you sure?"
          confirmLabel="Yes"
          onConfirm={onConfirm}
          onCancel={vi.fn()}
        />,
      ),
    );
    const yes = (
      Array.from(document.querySelectorAll("button")) as HTMLButtonElement[]
    ).find((b) => b.textContent?.trim() === "Yes");
    expect(yes).toBeTruthy();
    yes!.click();
    await waitFor(() => expect(onConfirm).toHaveBeenCalled());
  });

  it("with requireTyped='DELETE', primary stays disabled until typed correctly", async () => {
    const onConfirm = vi.fn();
    render(
      wrap(
        <ConfirmDialog
          open
          title="Type to confirm"
          body="Body"
          confirmLabel="Delete"
          requireTyped="DELETE"
          onConfirm={onConfirm}
          onCancel={vi.fn()}
        />,
      ),
    );
    const deleteBtn = () =>
      (Array.from(document.querySelectorAll("button")) as HTMLButtonElement[])
        .find((b) => b.textContent?.trim() === "Delete");
    // Polaris uses aria-disabled rather than native `disabled` on
    // ConnectedButton primary actions; check both.
    function isBlocked(btn?: HTMLButtonElement): boolean {
      if (!btn) return true;
      return btn.disabled || btn.getAttribute("aria-disabled") === "true";
    }
    expect(isBlocked(deleteBtn())).toBe(true);

    // Find the typed-confirm input.
    const inputs = Array.from(
      document.querySelectorAll<HTMLInputElement>("input"),
    );
    expect(inputs.length).toBeGreaterThan(0);
    fireEvent.change(inputs[0], { target: { value: "DELETE" } });

    await waitFor(() => expect(isBlocked(deleteBtn())).toBe(false));
    deleteBtn()!.click();
    await waitFor(() => expect(onConfirm).toHaveBeenCalled());
  });

  it("renders nothing user-visible when open=false", () => {
    render(
      wrap(
        <ConfirmDialog
          open={false}
          title="Hidden"
          body="Body"
          onConfirm={vi.fn()}
          onCancel={vi.fn()}
        />,
      ),
    );
    expect(screen.queryByRole("heading", { name: "Hidden" })).toBeNull();
  });
});
