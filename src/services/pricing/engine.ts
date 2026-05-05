/**
 * Bundle pricing engine.
 *
 * Pure function: PricingInput → PricingResult. No I/O, no globals.
 * Both this implementation and the Cart Transform Function (M-083+)
 * must produce identical output for the shared fixture set
 * (tests/pricing/fixtures/*.json) per ADR-0002.
 *
 * M-040 implements the `fixed` rule. Other rule types land in
 * M-041..M-045 with the same contract.
 *
 * See docs/specs/M-040-fixed-rule.md.
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
  if (rule.minQuantity !== undefined && totalQuantity < rule.minQuantity) {
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

function discountForRule(
  rule: PricingRule,
  subtotalCents: number,
): number {
  switch (rule.type) {
    case "fixed": {
      const cents = toCents(rule.value);
      return Math.max(0, Math.min(cents, subtotalCents));
    }
    case "percentage": {
      const pct = Number.parseFloat(rule.value);
      if (Number.isNaN(pct) || pct <= 0) return 0;
      const clampedPct = Math.min(100, pct);
      const discount = Math.floor((subtotalCents * clampedPct) / 100);
      return Math.max(0, Math.min(discount, subtotalCents));
    }
    // M-042..M-045 wire other types here.
    default:
      // Unknown type at this stage: log via skipped path; engine returns 0.
      return 0;
  }
}

export function computeBundlePrice(input: PricingInput): PricingResult {
  const { cents: subtotalCents, currencyCode, totalQuantity } = sumLineItemsCents(
    input.lineItems,
  );
  // Currency on the result follows the input's declared currency.
  const ccy = input.currencyCode || currencyCode;

  const evaluations = input.rules.map((rule) =>
    evaluateGates(rule, totalQuantity, subtotalCents, input.context),
  );

  const passing = evaluations.filter((e) => e.passed);
  const skipped: PricingResult["skipped"] = evaluations
    .filter((e) => !e.passed)
    .map((e) => ({ ruleId: e.rule.id, reason: e.reason ?? "gate_failed" }));

  // Non-stackable resolution: pick the highest-priority non-stackable rule
  // and discard the rest as skipped.
  const stackable = passing.filter((e) => e.rule.stackable);
  const nonStackable = passing
    .filter((e) => !e.rule.stackable)
    .sort((a, b) => b.rule.priority - a.rule.priority);

  const chosenNonStackable = nonStackable.length > 0 ? [nonStackable[0]] : [];
  for (const e of nonStackable.slice(1)) {
    skipped.push({
      ruleId: e.rule.id,
      reason: "non_stackable_lower_priority",
    });
  }

  const toApply = [...stackable, ...chosenNonStackable];

  const applied: AppliedRule[] = [];
  let totalDiscountCents = 0;
  for (const e of toApply) {
    const discount = discountForRule(e.rule, subtotalCents);
    if (discount === 0) continue;
    applied.push({
      ruleId: e.rule.id,
      discount: fromCents(discount, ccy),
    });
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
