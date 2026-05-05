# M-031 — Plan registry (full)

## Goal

Expand the M-008 stub at `src/services/billing/plans.ts` with annual
prices (20% discount per PRODUCT_PLAN §7), trial-day defaults, and a
`planFeatures(name)` getter.

## Why

Subsequent billing milestones (M-032/M-034) need the full price + trial
config. Domain services (M-049+) gate on feature flags via
`planFeatures`.

## Design

```ts
export interface PlanCaps { maxBundles, maxOrdersPerMonth, monthlyPriceUsd, annualPriceUsd, trialDays }
export interface PlanFeatures {
  visualBuilder: boolean;
  audit: boolean;
  threePlSync: boolean;
  abTesting: boolean;
  aiSuggestions: boolean;
  headless: boolean;
  customMetafields: boolean;
  shopifyFlow: boolean;
}
export const PLAN_FEATURES: Record<PlanName, PlanFeatures>;
export function planFeatures(name): PlanFeatures;
export function annualUsd(name): number; // 20% discount math
```

## Acceptance

- [ ] PLAN_CAPS gains `annualPriceUsd` (= round(monthly × 12 × 0.8)) and
      `trialDays`.
- [ ] PLAN_FEATURES populated per PRODUCT_PLAN §7.
- [ ] `annualUsd(name)` returns correct math.
- [ ] `planFeatures(name)` falls back to starter for unknown.
- [ ] Tests assert math + feature presence + monotonicity (higher tiers
      ⊇ lower tiers' features).

## Files

- `src/services/billing/plans.ts`
- `src/services/billing/plans.test.ts` (rewrite — currently lives implicitly
  via rateLimiter tests; add a dedicated spec)
