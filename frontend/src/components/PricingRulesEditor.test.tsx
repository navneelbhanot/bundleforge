import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { AppProvider } from "@shopify/polaris";

import { PricingRulesEditor } from "./PricingRulesEditor";

const i18n = { Polaris: { Common: { cancel: "Cancel" } } };

function wrap(node: React.ReactNode) {
  return <AppProvider i18n={i18n}>{node}</AppProvider>;
}

describe("PricingRulesEditor", () => {
  it("renders one card per initial rule with the rule type label", () => {
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
    expect(screen.getByText("Rule 1")).toBeTruthy();
    expect(screen.getByText("Rule 2")).toBeTruthy();
  });

  it("renders the empty state when no rules", () => {
    render(wrap(<PricingRulesEditor initial={[]} />));
    expect(screen.getByText(/No pricing rules yet/i)).toBeTruthy();
  });

  it("calls onChange with a percentage default when Add is clicked", () => {
    const onChange = vi.fn();
    const { container } = render(
      wrap(<PricingRulesEditor initial={[]} onChange={onChange} />),
    );
    // Click the header "Add rule" button directly via DOM. fireEvent on
    // Polaris's wrapped <Button> doesn't propagate reliably through the
    // span/svg wrappers, but native .click() on the resolved <button>
    // does trigger the React handler.
    const buttons = Array.from(
      container.querySelectorAll("button"),
    ) as HTMLButtonElement[];
    const addBtn = buttons.find((b) => b.textContent?.trim() === "Add rule");
    expect(addBtn).toBeTruthy();
    addBtn!.click();
    expect(onChange).toHaveBeenCalledTimes(1);
    const next = onChange.mock.calls[0][0];
    expect(next).toHaveLength(1);
    expect(next[0]).toMatchObject({ type: "percentage", value: 10 });
  });

  it("emits an update when the value field changes", () => {
    const onChange = vi.fn();
    const { container } = render(
      wrap(
        <PricingRulesEditor
          initial={[{ id: "r1", type: "percentage", value: 10 }]}
          onChange={onChange}
        />,
      ),
    );
    // Polaris number TextField renders both the visible input and a
    // hidden duplicate (for spinner / a11y), so getByLabelText and
    // getByDisplayValue both find two. The first number input in DOM
    // order is the value field (rendered before Min/Priority).
    const numberInputs = Array.from(
      container.querySelectorAll<HTMLInputElement>('input[type="number"]'),
    );
    const valueInput = numberInputs.find((i) => i.value === "10");
    expect(valueInput).toBeTruthy();
    fireEvent.change(valueInput!, { target: { value: "25" } });
    expect(onChange).toHaveBeenCalled();
    const last = onChange.mock.calls[onChange.mock.calls.length - 1][0];
    expect(last[0].value).toBe(25);
  });

  it("emits an update when stackability toggles", () => {
    const onChange = vi.fn();
    const { container } = render(
      wrap(
        <PricingRulesEditor
          initial={[{ id: "r1", type: "percentage", value: 10, isStackable: false }]}
          onChange={onChange}
        />,
      ),
    );
    const checkbox = container.querySelector(
      'input[type="checkbox"]',
    ) as HTMLInputElement;
    expect(checkbox).toBeTruthy();
    fireEvent.click(checkbox);
    const last = onChange.mock.calls[onChange.mock.calls.length - 1][0];
    expect(last[0].isStackable).toBe(true);
  });

  it("removes a rule when Remove is clicked", () => {
    const onChange = vi.fn();
    const { container } = render(
      wrap(
        <PricingRulesEditor
          initial={[
            { id: "r1", type: "percentage", value: 10 },
            { id: "r2", type: "fixed", value: 50 },
          ]}
          onChange={onChange}
        />,
      ),
    );
    const removeBtn = (
      Array.from(container.querySelectorAll("button")) as HTMLButtonElement[]
    ).find((b) => b.textContent?.trim() === "Remove");
    expect(removeBtn).toBeTruthy();
    removeBtn!.click();
    expect(onChange).toHaveBeenCalled();
    const last = onChange.mock.calls[onChange.mock.calls.length - 1][0];
    expect(last).toHaveLength(1);
    expect(last[0].id).toBe("r2");
  });
});
