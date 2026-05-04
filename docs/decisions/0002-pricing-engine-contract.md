# ADR-0002 — Single Pricing-Engine Contract Shared by Node and Cart Transform

- **Status:** accepted
- **Date:** 2026-05-04
- **Deciders:** Claude Code session 0000, user

---

## Context

Bundle pricing logic runs in two places:

1. The **Node service**, when computing prices for the admin UI, persisting
   `BundleOrder.original_price` / `discount_amount`, generating analytics, and
   validating cart contents in the App Proxy Checkout Guardian.
2. The **Cart Transform Function** (Shopify Function, JS or Wasm), which
   applies discounts at Shopify's checkout in milliseconds.

If these two implementations drift, customers will see different prices in the
cart vs. on checkout. This is the most-feared correctness bug in the system
and is exactly the failure pattern flagged in PRODUCT_PLAN §5
(checkout failures).

Sequential Claude Code sessions amplify this risk: a session that fixes a
pricing bug in Node may forget to propagate the fix to the Function, weeks
later, in a different session.

## Decision

Pricing is defined by a **single declarative contract** that both runtimes
consume:

- The contract is a TypeScript module (`src/services/pricing/contract.ts`) plus
  a generated JSON Schema (`src/services/pricing/contract.schema.json`) plus a
  generated test fixture set (`tests/pricing/fixtures/*.json`).
- The Node implementation is a pure function `computeBundlePrice(input)` in
  `src/services/pricing/engine.ts` whose only dependency is the contract.
- The Cart Transform Function is a thin adapter that maps Shopify's input
  shape into the contract input, calls a Function-internal port of the same
  pure logic, and maps the output back to Shopify's CartTransform output.
- Both runtimes are tested against the **same JSON fixture set**. The fixture
  set is the source of truth. A pricing change is not done until both
  implementations pass the same fixtures.
- A CI job (added in M-084) runs Node + Function fixtures and fails the build
  on any divergence.

The contract covers all `PricingRule.type` values in the schema:
`fixed`, `percentage`, `flat_discount`, `tiered`, `volume`, `bogo`, `custom`.
Each gets its own milestone (M-040 through M-045) and adds fixtures.

## Alternatives considered

- **Implement pricing only in the Function, call it from Node via Wasm or
  RPC.** Rejected. Wasm in Node is workable but adds toolchain weight, and
  Functions are not designed to be invoked from arbitrary contexts.
- **Implement only in Node, render bundle products as plain Shopify products
  with discount codes.** Rejected. Discount codes do not stack well, are
  visible to the customer, and cannot express mix-and-match or build-a-box
  semantics.
- **Tolerate two implementations, rely on tests to catch drift.** Rejected.
  Without a shared fixture set, tests on each side will drift in lockstep with
  the implementations.

## Consequences

- Positive
  - Pricing changes are atomic: edit the contract, regenerate fixtures, both
    sides must pass.
  - Sessions cannot accidentally change pricing in one runtime only — CI
    catches it.
  - The fixture set doubles as the regression suite.
- Negative
  - Higher upfront cost: M-039 must lock the contract before any pricing rule
    is implemented.
  - The Function must reimplement the pure logic in Function-compatible code
    (no Node std lib). This is acceptable because the logic is pure
    arithmetic.
- Follow-ups
  - M-039 writes the contract.
  - M-040–M-045 add one rule type each, both implementations + shared
    fixtures.
  - M-084 adds the cross-runtime fixture CI job.
