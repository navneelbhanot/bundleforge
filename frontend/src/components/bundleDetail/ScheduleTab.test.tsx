import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  cleanup,
} from "@testing-library/react";
import { AppProvider } from "@shopify/polaris";

import { ScheduleTab, type ScheduleSettings } from "./ScheduleTab";

const i18n = { Polaris: { Common: { cancel: "Cancel", save: "Save" } } };

function wrap(node: React.ReactNode) {
  return <AppProvider i18n={i18n}>{node}</AppProvider>;
}

function renderTab(
  overrides: Partial<{
    startsAt: string | null;
    endsAt: string | null;
    scheduleSettings: ScheduleSettings;
    shopTimezone: string;
    onSave: (patch: unknown) => Promise<void>;
  }> = {},
) {
  const onSave = overrides.onSave ?? vi.fn().mockResolvedValue(undefined);
  return {
    onSave,
    ...render(
      wrap(
        <ScheduleTab
          startsAt={overrides.startsAt ?? null}
          endsAt={overrides.endsAt ?? null}
          scheduleSettings={overrides.scheduleSettings ?? {}}
          shopTimezone={overrides.shopTimezone ?? "America/Los_Angeles"}
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

describe("ScheduleTab", () => {
  it("renders Window / Recurrence / End-behavior headings", () => {
    renderTab();
    expect(
      screen.getByRole("heading", { name: "Window", level: 2 }),
    ).toBeTruthy();
    expect(
      screen.getByRole("heading", { name: "Recurrence", level: 2 }),
    ).toBeTruthy();
    expect(
      screen.getByRole("heading", { name: "End behavior", level: 2 }),
    ).toBeTruthy();
  });

  it("Recurrence: picking weekly reveals the daysOfWeek choicelist", async () => {
    const { container } = renderTab();
    // The first <select> is the WindowCard timezone — find the
    // Recurrence Pattern Select by its current value "none".
    const selects = Array.from(container.querySelectorAll("select"));
    const patternSelect = selects.find((s) => s.value === "none")!;
    expect(patternSelect).toBeTruthy();
    fireEvent.change(patternSelect, { target: { value: "weekly" } });
    await waitFor(() =>
      expect(screen.getByText("Monday")).toBeTruthy(),
    );
    expect(screen.getByText("Saturday")).toBeTruthy();
  });

  it("Recurrence: picking monthly reveals the day-of-month field", async () => {
    const { container } = renderTab();
    const selects = Array.from(container.querySelectorAll("select"));
    const patternSelect = selects.find((s) => s.value === "none")!;
    fireEvent.change(patternSelect, { target: { value: "monthly" } });
    // The "Day of month" label is rendered as a TextField label —
    // find any input with that aria-labelled state.
    await waitFor(() => {
      const input = Array.from(
        container.querySelectorAll<HTMLInputElement>('input[type="number"]'),
      ).find((i) => i.max === "31");
      expect(input).toBeTruthy();
    });
  });

  it("End-behavior save sends scheduleSettings.endBehavior with no other keys", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const { container } = renderTab({
      scheduleSettings: { endBehavior: "archive" },
      onSave,
    });
    // Change end behavior radio to "pause".
    const radios = Array.from(
      container.querySelectorAll<HTMLInputElement>('input[type="radio"]'),
    );
    const pauseRadio = radios.find((r) => r.value === "pause")!;
    fireEvent.click(pauseRadio);
    // Click Save end behavior.
    const saveBtn = (
      Array.from(container.querySelectorAll("button")) as HTMLButtonElement[]
    ).find((b) => b.textContent?.trim() === "Save end behavior")!;
    saveBtn.click();
    await waitFor(() => expect(onSave).toHaveBeenCalled());
    expect(onSave).toHaveBeenCalledWith({
      scheduleSettings: { endBehavior: "pause" },
    });
  });

  it("Window card pre-fills date inputs from startsAt / endsAt props", () => {
    const { container } = renderTab({
      startsAt: "2026-01-15T09:30:00.000Z",
      endsAt: "2026-01-20T23:59:00.000Z",
    });
    const dateInputs = Array.from(
      container.querySelectorAll<HTMLInputElement>('input[type="date"]'),
    );
    expect(dateInputs.length).toBe(2);
    expect(dateInputs[0].value).toBe("2026-01-15");
    expect(dateInputs[1].value).toBe("2026-01-20");
    const timeInputs = Array.from(
      container.querySelectorAll<HTMLInputElement>('input[type="time"]'),
    );
    // First two time inputs are start + end time; the recurrence card's
    // time inputs are conditional on type !== "none" so they don't render
    // here.
    expect(timeInputs[0]?.value).toBe("09:30");
    expect(timeInputs[1]?.value).toBe("23:59");
  });

  // Note: an interactive "save button stays disabled when end < start" test
  // was attempted but Polaris TextField type="date" doesn't propagate
  // fireEvent.change in a way that re-triggers the WindowCard's `dirty`
  // computation reliably without `@testing-library/user-event`. The
  // equivalent server-side validation is locked in by the
  // BundleService "rejects endsAt before startsAt" test in
  // `src/services/bundles/index.test.ts`.
});
