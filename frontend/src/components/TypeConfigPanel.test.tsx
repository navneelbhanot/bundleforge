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
    render(wrap(<TypeConfigPanel type="weird-future-type" config={{}} />));
    expect(screen.getByText(/Free-form/i)).toBeTruthy();
  });

  it("renders the bogo form with buy/get quantities", () => {
    render(
      wrap(
        <TypeConfigPanel
          type="bogo"
          config={{ buyQuantity: 1, getQuantity: 1, getDiscountPercent: 100 }}
        />,
      ),
    );
    expect(screen.getByText(/Buy-one-get-one/i)).toBeTruthy();
  });

  it("renders the bxgy form distinctly from bogo", () => {
    render(
      wrap(
        <TypeConfigPanel
          type="bxgy"
          config={{ buyQuantity: 2, getQuantity: 1, getDiscountPercent: 50 }}
        />,
      ),
    );
    expect(screen.getByText(/Buy X, get Y/i)).toBeTruthy();
  });

  it("renders the volume form with tier count", () => {
    render(
      wrap(
        <TypeConfigPanel
          type="volume"
          config={{ tiers: [{}, {}, {}], aggregateAcrossLines: true }}
        />,
      ),
    );
    expect(screen.getByText(/Volume/i)).toBeTruthy();
  });

  it("renders the gift form", () => {
    render(
      wrap(
        <TypeConfigPanel
          type="gift"
          config={{ cartThreshold: 50, giftProductHandle: "free-tote" }}
        />,
      ),
    );
    expect(screen.getByText(/Free gift/i)).toBeTruthy();
  });

  it("renders the mystery form", () => {
    render(
      wrap(
        <TypeConfigPanel type="mystery" config={{ itemsPerBox: 3, allowDuplicates: true }} />,
      ),
    );
    expect(screen.getByText(/Mystery/i)).toBeTruthy();
  });

  it("renders the sample form", () => {
    render(
      wrap(
        <TypeConfigPanel
          type="sample"
          config={{ samplesPerPack: 5, requireFullSize: false }}
        />,
      ),
    );
    expect(screen.getByText("Sample / sampler")).toBeTruthy();
  });

  it("renders the subscription form", () => {
    render(
      wrap(
        <TypeConfigPanel
          type="subscription"
          config={{ intervalDays: 30, sellingPlanGroupId: "gid://shopify/SellingPlanGroup/1" }}
        />,
      ),
    );
    expect(screen.getByText("Subscription bundle")).toBeTruthy();
  });

  it("renders the custom card with field summary", () => {
    render(wrap(<TypeConfigPanel type="custom" config={{ foo: 1, bar: "x" }} />));
    expect(screen.getByText("Custom")).toBeTruthy();
    expect(screen.getByText(/foo, bar/)).toBeTruthy();
  });
});
