/**
 * Cart Transform Function entrypoint.
 *
 * Shopify invokes this with the input shape declared in run.graphql.
 * For each cart line carrying the BundleForge bundle attribute, we
 * compute a discount via the shared pricing engine and emit an
 * `update` operation to override the line price.
 */
import { computeBundlePrice, toCents, fromCents } from "./pricing.js";

const BUNDLE_ATTR = "_bundleforge_bundle_id";
const RULES_ATTR = "_bundleforge_rules";

/**
 * @typedef {{
 *   id: string,
 *   quantity: number,
 *   cost: { amountPerQuantity: { amount: string, currencyCode: string } },
 *   bundleforgeBundleId?: { value: string } | null,
 *   bundleforgeRules?: { value: string } | null
 * }} CartLine
 *
 * @typedef {{
 *   cart: { lines: CartLine[] },
 *   presentmentCurrencyRate: string
 * }} RunInput
 *
 * @typedef {{
 *   operations: Array<{
 *     update: {
 *       cartLineId: string,
 *       price: { adjustment: { fixedPricePerUnit: { amount: string } } }
 *     }
 *   }>
 * }} RunOutput
 */

function bundleIdOf(line) {
  return line && line.bundleforgeBundleId ? line.bundleforgeBundleId.value : null;
}

function rulesOf(line) {
  if (!line || !line.bundleforgeRules || !line.bundleforgeRules.value) return [];
  try {
    const parsed = JSON.parse(line.bundleforgeRules.value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * @param {RunInput} input
 * @returns {RunOutput}
 */
export function run(input) {
  const lines = (input && input.cart && input.cart.lines) || [];
  // Group cart lines by bundle id.
  const groups = new Map();
  for (const line of lines) {
    const bundleId = bundleIdOf(line);
    if (!bundleId) continue;
    if (!groups.has(bundleId)) groups.set(bundleId, []);
    groups.get(bundleId).push(line);
  }
  if (groups.size === 0) return { operations: [] };

  const operations = [];
  const now = new Date().toISOString();

  for (const [bundleId, bundleLines] of groups) {
    const rules = rulesOf(bundleLines[0]);
    const lineItems = bundleLines.map((l) => ({
      id: l.id,
      unitPrice: l.cost.amountPerQuantity,
      quantity: l.quantity,
    }));
    const currencyCode = bundleLines[0].cost.amountPerQuantity.currencyCode;
    const result = computeBundlePrice({
      bundleId,
      currencyCode,
      lineItems,
      rules,
      context: { now },
    });
    if (result.applied.length === 0) continue;

    // Distribute the discount proportionally across lines, then emit
    // one update per line with its new per-unit price.
    const totalDiscountCents = toCents(result.totalDiscount.amount);
    const subtotalCents = toCents(result.subtotal.amount);
    if (subtotalCents === 0) continue;
    let remaining = totalDiscountCents;
    for (let i = 0; i < bundleLines.length; i++) {
      const line = bundleLines[i];
      const lineSubtotal = toCents(line.cost.amountPerQuantity.amount) * line.quantity;
      const isLast = i === bundleLines.length - 1;
      const share = isLast
        ? remaining
        : Math.floor((lineSubtotal * totalDiscountCents) / subtotalCents);
      remaining -= share;
      const newPerUnit = Math.max(
        0,
        toCents(line.cost.amountPerQuantity.amount) - Math.floor(share / line.quantity),
      );
      operations.push({
        update: {
          cartLineId: line.id,
          price: {
            adjustment: {
              fixedPricePerUnit: { amount: fromCents(newPerUnit, currencyCode).amount },
            },
          },
        },
      });
    }
  }

  return { operations };
}

export default { run };
