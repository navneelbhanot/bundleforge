/**
 * Cart Transform Function entrypoint.
 *
 * Two paths run side-by-side:
 *
 *  1. Expand path (metafield-driven). When a cart line's variant
 *     belongs to a product flagged with `bundleforge.is_bundle = true`
 *     and carries a `bundleforge.components` JSON metafield, we emit
 *     an `expand` operation that swaps the bundle line for one line
 *     per component (variantId + quantity from the metafield). The
 *     bundle product's price is preserved as the parent — Shopify
 *     prices the expanded children at $0 unless overridden.
 *
 *  2. Update path (attribute-driven). Existing flow for storefronts
 *     that already place component variants in the cart with
 *     `_bundleforge_bundle_id` line attributes — we group, run the
 *     shared pricing engine, and emit `update` operations to override
 *     per-unit prices.
 *
 * Both paths can fire in the same call; they don't overlap because a
 * single cart line is either a packaged bundle (path 1) or a
 * components-as-attributes line (path 2).
 */
import { computeBundlePrice, toCents, fromCents } from "./pricing.js";

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

function isBundleProduct(line) {
  const product =
    line && line.merchandise && line.merchandise.product
      ? line.merchandise.product
      : null;
  if (!product) return false;
  const flag = product.isBundleMetafield && product.isBundleMetafield.value;
  return flag === "true" || flag === true;
}

function componentsPayload(line) {
  const product =
    line && line.merchandise && line.merchandise.product
      ? line.merchandise.product
      : null;
  if (!product || !product.componentsMetafield) return null;
  try {
    const parsed = JSON.parse(product.componentsMetafield.value);
    if (!parsed || typeof parsed !== "object") return null;
    if (parsed.schemaVersion !== 1) return null;
    return parsed;
  } catch {
    return null;
  }
}

function buildExpandOp(line, payload) {
  const components = Array.isArray(payload.components) ? payload.components : [];
  const expandedItems = [];
  for (const c of components) {
    if (!c || typeof c !== "object") continue;
    if (typeof c.variantGid !== "string" || c.variantGid.length === 0) continue;
    const qty = Number.isFinite(c.quantity) ? Math.max(1, Math.floor(c.quantity)) : 1;
    expandedItems.push({
      merchandiseId: c.variantGid,
      quantity: qty,
    });
  }
  if (expandedItems.length === 0) return null;
  return {
    expand: {
      cartLineId: line.id,
      expandedCartItems: expandedItems,
    },
  };
}

/**
 * Read the shop-level default cart mode from the optional shop
 * metafield `bundleforge.cart_default_mode`. Absent or unrecognized
 * values fall through to the default ("bundle_as_product"), which
 * keeps both paths active — matches today's behaviour.
 *
 * @param {object} input
 * @returns {"bundle_as_product" | "components_as_attributes"}
 */
function shopDefaultMode(input) {
  const v =
    input &&
    input.shop &&
    input.shop.cartDefaultModeMetafield &&
    input.shop.cartDefaultModeMetafield.value;
  if (v === "components_as_attributes") return "components_as_attributes";
  return "bundle_as_product";
}

/**
 * @param {object} input
 * @returns {object}
 */
export function run(input) {
  const lines = (input && input.cart && input.cart.lines) || [];
  const operations = [];
  const mode = shopDefaultMode(input);

  // --- Path 1: expand bundle products into component lines.
  // Skipped entirely when the merchant has opted into the legacy
  // components-as-attributes mode at the shop level.
  if (mode !== "components_as_attributes") {
    for (const line of lines) {
      if (!isBundleProduct(line)) continue;
      const payload = componentsPayload(line);
      if (!payload) continue;
      const expandOp = buildExpandOp(line, payload);
      if (expandOp) operations.push(expandOp);
    }
  }

  // --- Path 2: discount component lines that already carry bundle attributes. ---
  const groups = new Map();
  for (const line of lines) {
    const bundleId = bundleIdOf(line);
    if (!bundleId) continue;
    if (!groups.has(bundleId)) groups.set(bundleId, []);
    groups.get(bundleId).push(line);
  }
  if (groups.size === 0) return { operations };

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
