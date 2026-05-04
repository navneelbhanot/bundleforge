/**
 * Canonical pricing-engine contract.
 *
 * Both the Node engine (src/services/pricing/engine.ts, M-040+) and the
 * Cart Transform Function (extensions/cart-transform/, M-083+) consume
 * this exact shape. Per ADR-0002, divergence between the two is the
 * top correctness risk; this is the single source of truth.
 *
 * Money is encoded as decimal strings, not numbers, to avoid float
 * precision issues across runtimes (Wasm, JS, JSON).
 *
 * See docs/specs/M-039-pricing-engine.md.
 */

export const PRICING_CONTRACT_VERSION = 1;

export interface MoneyAmount {
  /** Decimal string, e.g. "12.50". */
  amount: string;
  /** ISO 4217 currency code. */
  currencyCode: string;
}

export interface PricingLineItem {
  /** Stable id (cart line id or bundle item id). */
  id: string;
  unitPrice: MoneyAmount;
  quantity: number;
  /** Optional bundle membership tag. */
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
  customerTags?: string[];
  countries?: string[];
  startsAt?: string;
  endsAt?: string;
}

export interface PricingRule {
  id: string;
  type: PricingRuleType;
  /** Discount value as decimal string. Semantics depend on type:
   *  - fixed: total discount amount
   *  - percentage: percent (0-100)
   *  - flat_discount: per-unit discount
   *  - tiered/volume: see rule type spec
   *  - bogo: free items count
   */
  value: string;
  minQuantity?: number;
  maxQuantity?: number;
  minCartValue?: string;
  conditions?: PricingRuleConditions;
  /** Higher priority wins when stackable=false. */
  priority: number;
  stackable: boolean;
}

export interface PricingContext {
  customerTags?: string[];
  country?: string;
  /** ISO timestamp for date-window checks. */
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
  discount: MoneyAmount;
}

export interface PricingResult {
  bundleId: string;
  currencyCode: string;
  subtotal: MoneyAmount;
  totalDiscount: MoneyAmount;
  /** subtotal − totalDiscount, never negative. */
  total: MoneyAmount;
  applied: AppliedRule[];
  /** Rules that matched gates but were skipped (e.g. non-stackable). */
  skipped: Array<{ ruleId: string; reason: string }>;
}
