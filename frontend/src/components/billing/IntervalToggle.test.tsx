import { describe, it, expect, vi, afterEach } from "vitest";
import { render, cleanup, within } from "@testing-library/react";
import { AppProvider } from "@shopify/polaris";
import enTranslations from "@shopify/polaris/locales/en.json";

import { IntervalToggle } from "./IntervalToggle";

afterEach(cleanup);

function renderWithPolaris(ui: React.ReactElement): ReturnType<typeof render> {
  return render(<AppProvider i18n={enTranslations}>{ui}</AppProvider>);
}

describe("IntervalToggle", () => {
  it("renders both segments with the annual one pressed by default", () => {
    const { container } = renderWithPolaris(
      <IntervalToggle value="annual" onChange={() => {}} />,
    );
    const monthly = within(container).getByRole("button", { name: /Monthly/i });
    const annual = within(container).getByRole("button", {
      name: /Annual/i,
    });
    expect(monthly.getAttribute("aria-pressed")).toBe("false");
    expect(annual.getAttribute("aria-pressed")).toBe("true");
  });

  it("renders monthly pressed when value=monthly", () => {
    const { container } = renderWithPolaris(
      <IntervalToggle value="monthly" onChange={() => {}} />,
    );
    const monthly = within(container).getByRole("button", { name: /Monthly/i });
    expect(monthly.getAttribute("aria-pressed")).toBe("true");
  });

  it("fires onChange('monthly') when the monthly segment is clicked", () => {
    const onChange = vi.fn();
    const { container } = renderWithPolaris(
      <IntervalToggle value="annual" onChange={onChange} />,
    );
    const monthly = within(container).getByRole("button", { name: /Monthly/i });
    monthly.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(onChange).toHaveBeenCalledWith("monthly");
  });

  it("fires onChange('annual') when the annual segment is clicked", () => {
    const onChange = vi.fn();
    const { container } = renderWithPolaris(
      <IntervalToggle value="monthly" onChange={onChange} />,
    );
    const annual = within(container).getByRole("button", { name: /Annual/i });
    annual.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(onChange).toHaveBeenCalledWith("annual");
  });
});
