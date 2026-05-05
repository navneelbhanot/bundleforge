/**
 * Bundle pricing — Cart Transform Function port.
 *
 * Mirrors src/services/pricing/engine.ts byte-for-byte. Both must
 * produce identical PricingResult for any PricingInput per ADR-0002.
 * This file is plain JS so the Shopify Function runtime can load it
 * without a build step.
 *
 * @typedef {{ amount: string, currencyCode: string }} MoneyAmount
 * @typedef {{
 *   id: string,
 *   unitPrice: MoneyAmount,
 *   quantity: number,
 *   bundleItemId?: string
 * }} PricingLineItem
 * @typedef {{
 *   id: string,
 *   type: 'fixed'|'percentage'|'flat_discount'|'tiered'|'volume'|'bogo'|'custom',
 *   value: string,
 *   minQuantity?: number,
 *   maxQuantity?: number,
 *   minCartValue?: string,
 *   conditions?: { customerTags?: string[], countries?: string[], startsAt?: string, endsAt?: string },
 *   priority: number,
 *   stackable: boolean
 * }} PricingRule
 * @typedef {{
 *   bundleId: string,
 *   currencyCode: string,
 *   lineItems: PricingLineItem[],
 *   rules: PricingRule[],
 *   context: { customerTags?: string[], country?: string, now: string }
 * }} PricingInput
 */

const HEX_AMOUNT = /^-?\d+(\.\d+)?$/;

/** "12.5" -> 1250. Banker's rounding at the cent. */
export function toCents(amount) {
  if (typeof amount !== "string" || !HEX_AMOUNT.test(amount)) {
    throw new Error("Invalid money amount: " + amount);
  }
  const negative = amount.startsWith("-");
  const abs = negative ? amount.slice(1) : amount;
  const parts = abs.split(".");
  const whole = parts[0];
  const fracRaw = parts[1] || "";
  const frac2 = (fracRaw + "00").slice(0, 2);
  const frac3 = (fracRaw + "000").slice(0, 3);
  let cents = parseInt(whole, 10) * 100 + parseInt(frac2, 10);
  const tail = parseInt(frac3.slice(2, 3) || "0", 10);
  const restNonZero = fracRaw.length > 3 && /[1-9]/.test(fracRaw.slice(3));
  if (tail > 5 || (tail === 5 && (restNonZero || cents % 2 === 1))) {
    cents += 1;
  }
  return negative ? -cents : cents;
}

export function fromCents(cents, currencyCode) {
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(cents);
  const whole = Math.floor(abs / 100);
  const frac = (abs % 100).toString().padStart(2, "0");
  return { amount: sign + whole + "." + frac, currencyCode };
}

function sumLineItemsCents(items) {
  if (items.length === 0) return { cents: 0, currencyCode: "USD", totalQuantity: 0 };
  const ccy = items[0].unitPrice.currencyCode;
  let cents = 0;
  let qty = 0;
  for (const item of items) {
    if (item.unitPrice.currencyCode !== ccy) {
      throw new Error("Mixed currencies: " + ccy + " vs " + item.unitPrice.currencyCode);
    }
    cents += toCents(item.unitPrice.amount) * item.quantity;
    qty += item.quantity;
  }
  return { cents, currencyCode: ccy, totalQuantity: qty };
}

function withinDateWindow(rule, nowIso) {
  const now = new Date(nowIso).getTime();
  if (rule.conditions && rule.conditions.startsAt) {
    if (now < new Date(rule.conditions.startsAt).getTime()) return false;
  }
  if (rule.conditions && rule.conditions.endsAt) {
    if (now > new Date(rule.conditions.endsAt).getTime()) return false;
  }
  return true;
}

function tagOrCountryMatches(rule, ctx) {
  const wantTags = (rule.conditions && rule.conditions.customerTags) || [];
  if (wantTags.length > 0) {
    const have = ((ctx && ctx.customerTags) || []).map(function (t) {
      return t.toLowerCase();
    });
    let ok = false;
    for (const t of wantTags) if (have.indexOf(t.toLowerCase()) >= 0) ok = true;
    if (!ok) return false;
  }
  const wantCountries = (rule.conditions && rule.conditions.countries) || [];
  if (wantCountries.length > 0) {
    const country = ((ctx && ctx.country) || "").toUpperCase();
    if (!country) return false;
    let ok = false;
    for (const c of wantCountries) if (c.toUpperCase() === country) ok = true;
    if (!ok) return false;
  }
  return true;
}

function evaluateGates(rule, totalQuantity, subtotalCents, ctx) {
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
    if (subtotalCents < toCents(rule.minCartValue)) {
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

function expandUnitPrices(input) {
  const out = [];
  for (const item of input.lineItems) {
    const cents = toCents(item.unitPrice.amount);
    for (let i = 0; i < item.quantity; i++) out.push(cents);
  }
  return out;
}

function discountForRule(rule, ctx) {
  const subtotalCents = ctx.subtotalCents;
  const totalQuantity = ctx.totalQuantity;
  const expanded = ctx.expandedUnitPricesCents;
  switch (rule.type) {
    case "fixed": {
      const cents = toCents(rule.value);
      return Math.max(0, Math.min(cents, subtotalCents));
    }
    case "percentage":
    case "tiered": {
      const pct = parseFloat(rule.value);
      if (Number.isNaN(pct) || pct <= 0) return 0;
      const clamped = Math.min(100, pct);
      return Math.max(0, Math.min(Math.floor((subtotalCents * clamped) / 100), subtotalCents));
    }
    case "flat_discount": {
      const perUnit = toCents(rule.value);
      if (perUnit <= 0) return 0;
      return Math.max(0, Math.min(perUnit * totalQuantity, subtotalCents));
    }
    case "volume": {
      const perUnit = toCents(rule.value);
      if (perUnit <= 0) return 0;
      const threshold = rule.minQuantity || 1;
      const qualifying = Math.max(0, totalQuantity - threshold + 1);
      return Math.max(0, Math.min(perUnit * Math.min(qualifying, totalQuantity), subtotalCents));
    }
    case "bogo": {
      const freePer = parseInt(rule.value, 10);
      if (!Number.isFinite(freePer) || freePer <= 0) return 0;
      const buyQty = rule.minQuantity || 1;
      if (buyQty <= 0) return 0;
      const setSize = buyQty + freePer;
      const sets = Math.floor(totalQuantity / setSize);
      if (sets <= 0) return 0;
      const totalFree = sets * freePer;
      const sorted = expanded.slice().sort(function (a, b) { return a - b; });
      let discount = 0;
      for (let i = 0; i < Math.min(totalFree, sorted.length); i++) discount += sorted[i];
      return Math.max(0, Math.min(discount, subtotalCents));
    }
    default:
      return 0;
  }
}

/**
 * @param {PricingInput} input
 * @returns {{
 *   bundleId: string,
 *   currencyCode: string,
 *   subtotal: MoneyAmount,
 *   totalDiscount: MoneyAmount,
 *   total: MoneyAmount,
 *   applied: { ruleId: string, discount: MoneyAmount }[],
 *   skipped: { ruleId: string, reason: string }[]
 * }}
 */
export function computeBundlePrice(input) {
  const sums = sumLineItemsCents(input.lineItems);
  const subtotalCents = sums.cents;
  const totalQuantity = sums.totalQuantity;
  const ccy = input.currencyCode || sums.currencyCode;
  const expandedUnitPricesCents = expandUnitPrices(input);

  const evaluations = input.rules.map(function (rule) {
    return evaluateGates(rule, totalQuantity, subtotalCents, input.context);
  });

  const passing = evaluations.filter(function (e) { return e.passed; });
  const skipped = evaluations
    .filter(function (e) { return !e.passed; })
    .map(function (e) { return { ruleId: e.rule.id, reason: e.reason || "gate_failed" }; });

  const stackable = passing.filter(function (e) { return e.rule.stackable; });
  const nonStackable = passing
    .filter(function (e) { return !e.rule.stackable; })
    .sort(function (a, b) { return b.rule.priority - a.rule.priority; });

  const chosenNonStackable = nonStackable.length > 0 ? [nonStackable[0]] : [];
  for (let i = 1; i < nonStackable.length; i++) {
    skipped.push({ ruleId: nonStackable[i].rule.id, reason: "non_stackable_lower_priority" });
  }

  const toApply = stackable.concat(chosenNonStackable);
  const dctx = { subtotalCents, totalQuantity, expandedUnitPricesCents };

  const applied = [];
  let totalDiscountCents = 0;
  for (const e of toApply) {
    const discount = discountForRule(e.rule, dctx);
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
