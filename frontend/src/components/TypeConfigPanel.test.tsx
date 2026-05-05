import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { AppProvider } from "@shopify/polaris";

import { TypeConfigPanel } from "./TypeConfigPanel";

const i18n = { Polaris: { Common: { cancel: "Cancel" } } };

function wrap(node: React.ReactNode) {
  return <AppProvider i18n={i18n}>{node}</AppProvider>;
}

describe("TypeConfigPanel", () => {
  it("renders the multipack form with packQuantity field", () => {
    render(wrap(<TypeConfigPanel type="multipack" config={{ packQuantity: 6 }} />));
    expect(screen.getByText(/Multipack/i)).toBeTruthy();
  });

  it("renders the mix_match form", () => {
    render(
      wrap(
        <TypeConfigPanel
          type="mix_match"
          config={{ minItems: 1, maxItems: 5, allowDuplicates: false }}
        />,
      ),
    );
    expect(screen.getByText(/Mix/i)).toBeTruthy();
  });

  it("falls back to free-form text for unknown types", () => {
    render(wrap(<TypeConfigPanel type="custom" config={{}} />));
    expect(screen.getByText(/Free-form/i)).toBeTruthy();
  });
});
