import { describe, it, expect, vi, afterEach } from "vitest";
import { render, cleanup, within } from "@testing-library/react";
import { AppProvider } from "@shopify/polaris";
import enTranslations from "@shopify/polaris/locales/en.json";

import { PlanCard, type PlanCardData } from "./PlanCard";

afterEach(cleanup);

function renderWithPolaris(ui: React.ReactElement): ReturnType<typeof render> {
  return render(<AppProvider i18n={enTranslations}>{ui}</AppProvider>);
}

const STARTER_PLAN: PlanCardData = {
  name: "starter",
  caps: {
    maxBundles: 5,
    maxOrdersPerMonth: 100,
    monthlyPriceUsd: 0,
    annualPriceUsd: 0,
    trialDays: 0,
  },
  features: { visualBuilder: true },
};

const GROWTH_PLAN: PlanCardData = {
  name: "growth",
  caps: {
    maxBundles: null,
    maxOrdersPerMonth: null,
    monthlyPriceUsd: 12,
    annualPriceUsd: 115,
    trialDays: 14,
  },
  features: {
    visualBuilder: true,
    auditTrail: true,
    liveChat: true,
    basicAnalytics: true,
    posSingleLocation: true,
    aiSuggestions: true,
  },
};

const PRO_PLAN: PlanCardData = {
  name: "pro",
  caps: {
    maxBundles: null,
    maxOrdersPerMonth: null,
    monthlyPriceUsd: 35,
    annualPriceUsd: 336,
    trialDays: 14,
  },
  features: {
    ...GROWTH_PLAN.features,
    threePlSync: true,
    abTesting: true,
    shopifyFlow: true,
    customMetafields: true,
  },
};

describe("PlanCard", () => {
  it("shows the 'Current plan' badge when this card matches the current plan", () => {
    const { container } = renderWithPolaris(
      <PlanCard
        plan={GROWTH_PLAN}
        currentPlan="growth"
        interval="annual"
        busy={false}
        onSubscribe={() => {}}
      />,
    );
    // Both the badge and the disabled action button carry the
    // same "Current plan" text — grab them at minimum count = 2.
    const matches = within(container).getAllByText("Current plan");
    expect(matches.length).toBeGreaterThanOrEqual(2);
    // Action button is disabled.
    const button = within(container).getByRole("button", {
      name: /Current plan/i,
    });
    expect(button.getAttribute("aria-disabled")).toBe("true");
  });

  it("shows 'Most popular' on Growth when it's not the current plan", () => {
    const { container } = renderWithPolaris(
      <PlanCard
        plan={GROWTH_PLAN}
        currentPlan="starter"
        interval="annual"
        busy={false}
        onSubscribe={() => {}}
      />,
    );
    expect(within(container).getByText("Most popular")).toBeTruthy();
  });

  it("does NOT show 'Most popular' on non-Growth plans", () => {
    const { container } = renderWithPolaris(
      <PlanCard
        plan={PRO_PLAN}
        currentPlan="starter"
        interval="annual"
        busy={false}
        onSubscribe={() => {}}
      />,
    );
    expect(within(container).queryByText("Most popular")).toBeNull();
  });

  it("renders 'Free' for Starter regardless of interval", () => {
    const { container: c1 } = renderWithPolaris(
      <PlanCard
        plan={STARTER_PLAN}
        currentPlan="starter"
        interval="annual"
        busy={false}
        onSubscribe={() => {}}
      />,
    );
    expect(within(c1).getByText("Free")).toBeTruthy();
    cleanup();
    const { container: c2 } = renderWithPolaris(
      <PlanCard
        plan={STARTER_PLAN}
        currentPlan="starter"
        interval="monthly"
        busy={false}
        onSubscribe={() => {}}
      />,
    );
    expect(within(c2).getByText("Free")).toBeTruthy();
  });

  it("shows annual price when interval=annual on a paid plan", () => {
    const { container } = renderWithPolaris(
      <PlanCard
        plan={GROWTH_PLAN}
        currentPlan="starter"
        interval="annual"
        busy={false}
        onSubscribe={() => {}}
      />,
    );
    expect(within(container).getByText("$115/yr")).toBeTruthy();
  });

  it("shows monthly price when interval=monthly on a paid plan", () => {
    const { container } = renderWithPolaris(
      <PlanCard
        plan={GROWTH_PLAN}
        currentPlan="starter"
        interval="monthly"
        busy={false}
        onSubscribe={() => {}}
      />,
    );
    expect(within(container).getByText("$12/mo")).toBeTruthy();
  });

  it("renders 'Unlimited bundles' / 'Unlimited orders' for paid plans", () => {
    const { container } = renderWithPolaris(
      <PlanCard
        plan={GROWTH_PLAN}
        currentPlan="starter"
        interval="annual"
        busy={false}
        onSubscribe={() => {}}
      />,
    );
    expect(within(container).getByText("Unlimited bundles")).toBeTruthy();
    expect(within(container).getByText(/Unlimited orders/i)).toBeTruthy();
  });

  it("renders the cap line for Starter as '5 bundles' / '100 orders'", () => {
    const { container } = renderWithPolaris(
      <PlanCard
        plan={STARTER_PLAN}
        currentPlan="starter"
        interval="annual"
        busy={false}
        onSubscribe={() => {}}
      />,
    );
    expect(within(container).getByText("5 bundles")).toBeTruthy();
    expect(within(container).getByText(/100 orders/i)).toBeTruthy();
  });

  it("only renders feature rows for flags that are true", () => {
    const { container } = renderWithPolaris(
      <PlanCard
        plan={GROWTH_PLAN}
        currentPlan="starter"
        interval="annual"
        busy={false}
        onSubscribe={() => {}}
      />,
    );
    // Should be present (true on Growth):
    expect(within(container).getByText("Audit trail", { exact: false })).toBeTruthy();
    expect(within(container).getByText("AI bundle suggestions")).toBeTruthy();
    // Should NOT be present (false on Growth):
    expect(within(container).queryByText("3PL inventory sync")).toBeNull();
    expect(within(container).queryByText("White-label branding")).toBeNull();
  });

  it("fires onSubscribe(plan, interval) when the action is clicked", () => {
    const onSubscribe = vi.fn();
    const { container } = renderWithPolaris(
      <PlanCard
        plan={GROWTH_PLAN}
        currentPlan="starter"
        interval="annual"
        busy={false}
        onSubscribe={onSubscribe}
      />,
    );
    const button = within(container).getByRole("button", { name: /Upgrade/i });
    button.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(onSubscribe).toHaveBeenCalledWith("growth", "annual");
  });

  it("renders 'Upgrade' for higher-rank plan than current", () => {
    const { container } = renderWithPolaris(
      <PlanCard
        plan={PRO_PLAN}
        currentPlan="growth"
        interval="annual"
        busy={false}
        onSubscribe={() => {}}
      />,
    );
    expect(within(container).getByRole("button", { name: /Upgrade/i })).toBeTruthy();
  });

  it("renders 'Downgrade' (disabled) for lower-rank plan than current", () => {
    const { container } = renderWithPolaris(
      <PlanCard
        plan={STARTER_PLAN}
        currentPlan="growth"
        interval="annual"
        busy={false}
        onSubscribe={() => {}}
      />,
    );
    const button = within(container).getByRole("button", { name: /Downgrade/i });
    expect(button.getAttribute("aria-disabled")).toBe("true");
  });

  it("disables the action button when busy=true", () => {
    const { container } = renderWithPolaris(
      <PlanCard
        plan={GROWTH_PLAN}
        currentPlan="starter"
        interval="annual"
        busy={true}
        onSubscribe={() => {}}
      />,
    );
    const button = within(container).getByRole("button", { name: /Upgrade/i });
    expect(button.getAttribute("aria-disabled")).toBe("true");
  });
});
