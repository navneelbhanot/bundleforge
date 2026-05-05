/**
 * Bundle pricing engine.
 *
 * Pure function: PricingInput → PricingResult. No I/O, no globals.
 * Both this implementation and the Cart Transform Function (M-083+)
 * must produce identical output for the shared fixture set
 * (tests/pricing/fixtures/*.json) per ADR-0002.
 *
 * Rule types: fixed (M-040), percentage (M-041), flat_discount (M-042),
 * tiered (M-043), volume (M-044), bogo (M-045).
 *
 * Stackability + priority: M-040 (verified M-046).
 * Conditions (tags, countries, dates): M-040 (verified M-047).
 */
import type {
  AppliedRule,
  PricingInput,
  PricingResult,
  PricingRule,
} from "./contract";
import { fromCents, sumLineItemsCents, toCents } from "./money";

interface RuleEvaluation {
  rule: PricingRule;
  passed: boolean;
  reason?: string;
}

function withinDateWindow(rule: PricingRule, nowIso: string): boolean {
  const now = new Date(nowIso).getTime();
  if (rule.conditions?.startsAt) {
    const start = new Date(rule.conditions.startsAt).getTime();
    if (now < start) return false;
  }
  if (rule.conditions?.endsAt) {
    const end = new Date(rule.conditions.endsAt).getTime();
    if (now > end) return false;
  }
  return true;
}

function tagOrCountryMatches(rule: PricingRule, ctx: PricingInput["context"]): boolean {
  const wantTags = rule.conditions?.customerTags ?? [];
  if (wantTags.length > 0) {
    const have = (ctx.customerTags ?? []).map((t) => t.toLowerCase());
    const ok = wantTags.some((t) => have.includes(t.toLowerCase()));
    if (!ok) return false;
  }
  const wantCountries = rule.conditions?.countries ?? [];
  if (wantCountries.length > 0) {
    const country = (ctx.country ?? "").toUpperCase();
    if (!country || !wantCountries.map((c) => c.toUpperCase()).includes(country)) {
      return false;
    }
  }
  return true;
}

function evaluateGates(
  rule: PricingRule,
  totalQuantity: number,
  subtotalCents: number,
  ctx: PricingInput["context"],
): RuleEvaluation {
  // BOGO uses minQuantity as part of its arithmetic, not as a gate. The
  // engine still skips if there isn't enough quantity to form one set,
  // but that's an arithmetic outcome, not a gate failure.
  if (
    rule.type !== "bogo" &&
    rule.minQuantity !== undefined &&
    totalQuantity < rule.minQuantity
  ) {
    return { rule, passed: false, reason: "min_quantity_not_met" };
  }
  if (rule.maxQuantity !== undefined && totalQuantity > rule.maxQuantity) {
    return { rule, passed: false, reason: "max_quantity_exceeded" };
  }
  if (rule.minCartValue !== undefined) {
    const min = toCents(rule.minCartValue);
    if (subtotalCents < min) {
      return { rule, passed: false, reason: "min_cart_value_not_met" };
    }
  }
  if (!withinDateWindow(rule, ctx.now)) {
    return { rule, passed: false, reason: "outside_date_window" };
  }
  if (!tagOrCountryMatches(rule, ctx)) {
    return { rule, passed: false, reason: "condition_not_met" };
  }
  return { rule, passed: true };
}

interface DiscountContext {
  subtotalCents: number;
  totalQuantity: number;
  /** Per-unit prices in cents, expanded by quantity (one entry per unit). */
  expandedUnitPricesCents: number[];
}

function discountForRule(rule: PricingRule, ctx: DiscountContext): number {
  const { subtotalCents, totalQuantity, expandedUnitPricesCents } = ctx;
  switch (rule.type) {
    case "fixed": {
      const cents = toCents(rule.value);
      return Math.max(0, Math.min(cents, subtotalCents));
    }
    case "percentage":
    case "tiered": {
      // tiered uses the same arithmetic as percentage; tier selection
      // happens via minQuantity gates + non-stackable + priority.
      const pct = Number.parseFloat(rule.value);
      if (Number.isNaN(pct) || pct <= 0) return 0;
      const clamped = Math.min(100, pct);
      const discount = Math.floor((subtotalCents * clamped) / 100);
      return Math.max(0, Math.min(discount, subtotalCents));
    }
    case "flat_discount": {
      const perUnit = toCents(rule.value);
      if (perUnit <= 0) return 0;
      return Math.max(0, Math.min(perUnit * totalQuantity, subtotalCents));
    }
    case "volume": {
      // Per-unit discount applied only to qualifying units AT or beyond
      // the threshold (minQuantity). Without minQuantity, treats all units.
      const perUnit = toCents(rule.value);
      if (perUnit <= 0) return 0;
      const threshold = rule.minQuantity ?? 1;
      const qualifyingQty = Math.max(0, totalQuantity - threshold + 1);
      return Math.max(
        0,
        Math.min(perUnit * Math.min(qualifyingQty, totalQuantity), subtotalCents),
      );
    }
    case "bogo": {
      // Buy `minQuantity` items, get `value` items free per qualifying set.
      // Free items are the cheapest units (merchant-safe).
      const freePer = Number.parseInt(rule.value, 10);
      if (!Number.isFinite(freePer) || freePer <= 0) return 0;
      const buyQty = rule.minQuantity ?? 1;
      if (buyQty <= 0) return 0;
      const setSize = buyQty + freePer;
      const sets = Math.floor(totalQuantity / setSize);
      if (sets <= 0) return 0;
      const totalFree = sets * freePer;
      const sorted = [...expandedUnitPricesCents].sort((a, b) => a - b);
      let discount = 0;
      for (let i = 0; i < Math.min(totalFree, sorted.length); i++) {
        discount += sorted[i];
      }
      return Math.max(0, Math.min(discount, subtotalCents));
    }
    default:
      return 0;
  }
}

function expandUnitPrices(input: PricingInput): number[] {
  const out: number[] = [];
  for (const item of input.lineItems) {
    const cents = toCents(item.unitPrice.amount);
    for (let i = 0; i < item.quantity; i++) out.push(cents);
  }
  return out;
}

export function computeBundlePrice(input: PricingInput): PricingResult {
  const { cents: subtotalCents, currencyCode, totalQuantity } = sumLineItemsCents(
    input.lineItems,
  );
  const ccy = input.currencyCode || currencyCode;
  const expandedUnitPricesCents = expandUnitPrices(input);

  const evaluations = input.rules.map((rule) =>
    evaluateGates(rule, totalQuantity, subtotalCents, input.context),
  );

  const passing = evaluations.filter((e) => e.passed);
  const skipped: PricingResult["skipped"] = evaluations
    .filter((e) => !e.passed)
    .map((e) => ({ ruleId: e.rule.id, reason: e.reason ?? "gate_failed" }));

  const stackable = passing.filter((e) => e.rule.stackable);
  const nonStackable = passing
    .filter((e) => !e.rule.stackable)
    .sort((a, b) => b.rule.priority - a.rule.priority);

  const chosenNonStackable = nonStackable.length > 0 ? [nonStackable[0]] : [];
  for (const e of nonStackable.slice(1)) {
    skipped.push({ ruleId: e.rule.id, reason: "non_stackable_lower_priority" });
  }

  const toApply = [...stackable, ...chosenNonStackable];
  const ctx: DiscountContext = { subtotalCents, totalQuantity, expandedUnitPricesCents };

  const applied: AppliedRule[] = [];
  let totalDiscountCents = 0;
  for (const e of toApply) {
    const discount = discountForRule(e.rule, ctx);
    if (discount === 0) continue;
    applied.push({ ruleId: e.rule.id, discount: fromCents(discount, ccy) });
    totalDiscountCents += discount;
  }

  if (totalDiscountCents > subtotalCents) totalDiscountCents = subtotalCents;
  const totalCents = subtotalCents - totalDiscountCents;

  return {
    bundleId: input.bundleId,
    currencyCode: ccy,
    subtotal: fromCents(subtotalCents, ccy),
    totalDiscount: fromCents(totalDiscountCents, ccy),
    total: fromCents(totalCents, ccy),
    applied,
    skipped,
  };
}
