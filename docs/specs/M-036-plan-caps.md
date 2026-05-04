# M-036 — plan caps middleware

## Goal

`requirePlanFeature(featureName)` middleware reads req.shopId, looks up
the shop's plan via BillingSubscription, and rejects with
ForbiddenError if the feature is gated.

`enforceCap('maxBundles')` similarly checks the bundle count vs the cap.

## Acceptance

- [ ] `loadPlanForShop(shopId)` resolves a plan name from
      BillingSubscription, or returns "starter" if there's no row (the
      shop is on the free plan).
- [ ] `requirePlanFeature("threePlSync")` middleware allows pro+ shops,
      rejects others with 403 + code "feature_not_in_plan".
- [ ] `enforceCap("maxBundles")` middleware uses prisma to count active
      bundles vs `PLAN_CAPS[plan].maxBundles`, 403 when at cap.
- [ ] All DI-friendly; tests use vi.fn().

## Files

- `src/middleware/planCaps.ts`
- `src/middleware/planCaps.test.ts`
