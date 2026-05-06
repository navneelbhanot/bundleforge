import { describe, it, expect, vi, afterEach } from "vitest";
import { render, fireEvent, cleanup } from "@testing-library/react";
import { AppProvider } from "@shopify/polaris";

import { AppLanguageSelect } from "./AppLanguageSelect";

const i18n = { Polaris: { Common: { cancel: "Cancel", save: "Save" } } };

afterEach(cleanup);

describe("AppLanguageSelect (M-186)", () => {
  it("renders the current value as selected", () => {
    const { container } = render(
      <AppProvider i18n={i18n}>
        <AppLanguageSelect value="fr" onChange={vi.fn()} />
      </AppProvider>,
    );
    const select = container.querySelector("select") as HTMLSelectElement;
    expect(select.value).toBe("fr");
  });

  it("fires onChange with the picked locale", () => {
    const onChange = vi.fn();
    const { container } = render(
      <AppProvider i18n={i18n}>
        <AppLanguageSelect value="en" onChange={onChange} />
      </AppProvider>,
    );
    const select = container.querySelector("select") as HTMLSelectElement;
    fireEvent.change(select, { target: { value: "de" } });
    // Polaris Select calls onChange(value, id), so just verify the
    // first arg.
    expect(onChange).toHaveBeenCalled();
    expect(onChange.mock.calls[0][0]).toBe("de");
  });

  it("disables the select while busy", () => {
    const { container } = render(
      <AppProvider i18n={i18n}>
        <AppLanguageSelect value="en" busy onChange={vi.fn()} />
      </AppProvider>,
    );
    const select = container.querySelector("select") as HTMLSelectElement;
    expect(select.disabled).toBe(true);
  });
});
