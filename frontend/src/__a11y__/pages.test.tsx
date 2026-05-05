/**
 * M-141 — accessibility smoke tests.
 *
 * Renders each top-level page wrapped in Polaris' AppProvider into jsdom and
 * runs axe-core for WCAG-AA violations. Polaris is WCAG AA out of the box;
 * this test is a regression net against own-code mistakes (missing alt
 * text, label-less inputs, etc.).
 *
 * We invoke axe-core directly rather than via vitest-axe — vitest-axe uses
 * `createRequire(import.meta.url)` which trips vitest's module loader.
 */
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { render } from "@testing-library/react";
import { AppProvider } from "@shopify/polaris";
import axe from "axe-core";

import { SettingsPage } from "../pages/SettingsPage";
import { AnalyticsOverviewPage } from "../pages/AnalyticsOverviewPage";
import { AbTestsPage } from "../pages/AbTestsPage";

const i18n = { Polaris: { Common: { cancel: "Cancel" } } };

function wrap(node: React.ReactNode): JSX.Element {
  return <AppProvider i18n={i18n}>{node}</AppProvider>;
}

async function runAxe(node: Element): Promise<axe.AxeResults> {
  return await axe.run(node, {
    runOnly: { type: "tag", values: ["wcag2a", "wcag2aa"] },
    // jsdom doesn't lay out — skip checks that require real layout.
    rules: {
      "color-contrast": { enabled: false },
    },
  });
}

beforeAll(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(() => Promise.reject(new Error("network disabled in a11y test"))),
  );
});

afterAll(() => {
  vi.unstubAllGlobals();
});

describe("a11y — page shells", () => {
  it("SettingsPage has no axe violations", async () => {
    const { container } = render(wrap(<SettingsPage />));
    const results = await runAxe(container);
    expect(results.violations).toEqual([]);
  });

  it("AnalyticsOverviewPage has no axe violations", async () => {
    const { container } = render(wrap(<AnalyticsOverviewPage />));
    const results = await runAxe(container);
    expect(results.violations).toEqual([]);
  });

  it("AbTestsPage has no axe violations", async () => {
    const { container } = render(wrap(<AbTestsPage />));
    const results = await runAxe(container);
    expect(results.violations).toEqual([]);
  });
});
