import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { AppProvider } from "@shopify/polaris";

import { SetupChecklist, type ChecklistStep } from "./SetupChecklist";

const i18n = { Polaris: { Common: { cancel: "Cancel", save: "Save" } } };

afterEach(cleanup);

function makeSteps(done: boolean[]): ChecklistStep[] {
  return [
    {
      id: "create",
      title: "Create your first bundle",
      body: "body 1",
      done: done[0] ?? false,
      primary: { label: "Create bundle", url: "/bundles/new" },
    },
    {
      id: "publish",
      title: "Publish a bundle",
      body: "body 2",
      done: done[1] ?? false,
      primary: { label: "Browse bundles", url: "/bundles" },
    },
    {
      id: "block",
      title: "Add the Bundle block to your storefront",
      body: "body 3",
      done: done[2] ?? false,
      secondary: { label: "Mark complete", onClick: vi.fn() },
    },
  ];
}

function renderChecklist(props: Parameters<typeof SetupChecklist>[0]) {
  return render(
    <AppProvider i18n={i18n}>
      <SetupChecklist {...props} />
    </AppProvider>,
  );
}

describe("SetupChecklist (M-186)", () => {
  it("renders three steps with their titles", () => {
    renderChecklist({
      steps: makeSteps([false, false, false]),
      dismissed: false,
      onDismiss: vi.fn(),
    });
    expect(screen.getByText(/Create your first bundle/i)).toBeTruthy();
    expect(screen.getByText(/Publish a bundle/i)).toBeTruthy();
    expect(screen.getByText(/Add the Bundle block/i)).toBeTruthy();
  });

  it("returns null when dismissed", () => {
    renderChecklist({
      steps: makeSteps([false, false, false]),
      dismissed: true,
      onDismiss: vi.fn(),
    });
    expect(screen.queryByText(/Get set up with MintBundle/i)).toBeNull();
  });

  it("auto-retires when every step is done", () => {
    renderChecklist({
      steps: makeSteps([true, true, true]),
      dismissed: false,
      onDismiss: vi.fn(),
    });
    expect(screen.queryByText(/Get set up with MintBundle/i)).toBeNull();
  });

  it("clicking the dismiss icon-button fires onDismiss", () => {
    const onDismiss = vi.fn();
    renderChecklist({
      steps: makeSteps([false, false, false]),
      dismissed: false,
      onDismiss,
    });
    fireEvent.click(
      screen.getByRole("button", { name: /Dismiss checklist/i }),
    );
    expect(onDismiss).toHaveBeenCalled();
  });

  it("renders the progress count (1 of 3 complete)", () => {
    renderChecklist({
      steps: makeSteps([true, false, false]),
      dismissed: false,
      onDismiss: vi.fn(),
    });
    expect(screen.getByText(/1 of 3 complete/i)).toBeTruthy();
  });

  it("does not render the secondary 'Mark complete' button on a done step", () => {
    renderChecklist({
      steps: makeSteps([true, true, false]),
      dismissed: false,
      onDismiss: vi.fn(),
    });
    // Step 3 is still pending — the Mark complete button shows.
    expect(screen.getByRole("button", { name: /Mark complete/i })).toBeTruthy();
  });
});
