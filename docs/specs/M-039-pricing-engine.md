# M-039 — Pricing engine spec lock + types + JSON schema

## Goal

Lock the canonical pricing-engine contract that both the Node service
(M-040+) and the Cart Transform Function (M-083+) consume. Per ADR-0002,
divergence between the two implementations is the most-feared
correctness bug; this milestone is the keystone that prevents it.

## Why

PRODUCT_PLAN §5 calls out checkout failures (mismatched prices) as the
worst class of competitor bug. ADR-0002 mandates a single source of
truth shared across runtimes. M-039 ships the source of truth.

## Out of scope

- Implementing any rule type (M-040 onward).
- Generating Wasm-compatible code for the Function. The contract is
  language-agnostic; the Function reads the same fixtures.

## Design

### Types (`src/services/pricing/contract.ts`)

```ts
export interface MoneyAmount {
  /** Decimal value as a string for fixed precision (e.g. "12.50"). */
  amount: string;
  currencyCode: string;
}

export interface PricingLineItem {
  /** Stable id for tying back to cart line items / bundle items. */
  id: string;
  /** Per-unit list price. */
  unitPrice: MoneyAmount;
  /** Quantity in the cart for this line item. */
  quantity: number;
  /** Optional bundle membership tag (e.g., bundle item id). */
  bundleItemId?: string;
}

export type PricingRuleType =
  | "fixed"
  | "percentage"
  | "flat_discount"
  | "tiered"
  | "volume"
  | "bogo"
  | "custom";

export interface PricingRuleConditions {
  customerTags?: string[];   // OR-match
  countries?: string[];      // ISO codes; OR-match
  startsAt?: string;         // ISO timestamp
  endsAt?: string;           // ISO timestamp
}

export interface PricingRule {
  id: string;
  type: PricingRuleType;
  /** Discount value, semantics vary by type. */
  value: string; // decimal string
  minQuantity?: number;
  maxQuantity?: number;
  minCartValue?: string; // decimal string
  conditions?: PricingRuleConditions;
  /** Higher priority wins when stackable=false. */
  priority: number;
  stackable: boolean;
}

export interface PricingContext {
  /** Customer tags (lowercase). */
  customerTags?: string[];
  /** ISO country code. */
  country?: string;
  /** Now, for date-window evaluation. ISO timestamp. */
  now: string;
}

export interface PricingInput {
  bundleId: string;
  currencyCode: string;
  lineItems: PricingLineItem[];
  rules: PricingRule[];
  context: PricingContext;
}

export interface AppliedRule {
  ruleId: string;
  /** Discount applied by this rule, in cart currency. */
  discount: MoneyAmount;
}

export interface PricingResult {
  bundleId: string;
  currencyCode: string;
  /** Sum of unitPrice × quantity across all line items, before discounts. */
  subtotal: MoneyAmount;
  /** Sum of all applied discounts. */
  totalDiscount: MoneyAmount;
  /** subtotal - totalDiscount, never negative. */
  total: MoneyAmount;
  applied: AppliedRule[];
  /** Rules that matched min/max/condition gates but weren't applied
   *  due to stackability. Surface for explainability. */
  skipped: Array<{ ruleId: string; reason: string }>;
}

export const SCHEMA_VERSION = 1;
```

### JSON Schema

A generated `src/services/pricing/contract.schema.json` derived from
the TS types via a one-shot script (M-039 ships the file by hand for
now; a generator can land later if needed). Validation library:
`ajv` is overkill at this stage — Zod equivalents will land in M-040
when actual rule validators are needed.

### Fixture-set framework

`tests/pricing/fixtures/*.json` — each file is `{name, input,
expected}`. M-039 ships a `loadFixtures(dir)` helper + an empty
fixtures directory. M-040 adds the first fixtures.

### Acceptance

- [ ] `src/services/pricing/contract.ts` exists and exports every type.
- [ ] `src/services/pricing/contract.schema.json` exists and matches.
- [ ] `tests/pricing/fixtures/` exists.
- [ ] `tests/pricing/loadFixtures.ts` exists with helper + 1 unit test
      that asserts schema versions match.
- [ ] Boot phase remains green.

## Files

- `src/services/pricing/contract.ts`
- `src/services/pricing/contract.schema.json`
- `tests/pricing/loadFixtures.ts`
- `tests/pricing/loadFixtures.test.ts`
- `tests/pricing/fixtures/.gitkeep`
