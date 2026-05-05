import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { AppProvider } from "@shopify/polaris";

import { PricingRulesEditor } from "./PricingRulesEditor";

const i18n = { Polaris: { Common: { cancel: "Cancel" } } };

function wrap(node: React.ReactNode) {
  return <AppProvider i18n={i18n}>{node}</AppProvider>;
}

describe("PricingRulesEditor", () => {
  it("renders one row per initial rule", () => {
    render(
      wrap(
        <PricingRulesEditor
          initial={[
            { type: "fixed", value: 5, isStackable: false },
            { type: "percentage", value: 10, isStackable: true },
          ]}
        />,
      ),
    );
    expect(screen.getByText("fixed")).toBeTruthy();
    expect(screen.getByText("percentage")).toBeTruthy();
  });

  it("calls onChange when Add is clicked", () => {
    const onChange = vi.fn();
    render(
      wrap(<PricingRulesEditor initial={[]} onChange={onChange} />),
    );
    const buttons = screen.getAllByRole("button", { name: "Add rule" });
    fireEvent.click(buttons[buttons.length - 1]);
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0][0]).toHaveLength(1);
  });
});
