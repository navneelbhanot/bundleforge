/**
 * Cart Transform Function entrypoint.
 *
 * Two paths run side-by-side:
 *
 *  1. Expand path (metafield-driven). When a cart line's variant
 *     belongs to a product flagged with `mintbundle.is_bundle = true`
 *     and carries a `mintbundle.components` JSON metafield, we emit
 *     an `expand` operation that swaps the bundle line for one line
 *     per component (variantId + quantity from the metafield). The
 *     bundle product's price is preserved as the parent — Shopify
 *     prices the expanded children at $0 unless overridden.
 *
 *  2. Update path (attribute-driven). Existing flow for storefronts
 *     that already place component variants in the cart with
 *     `_mintbundle_bundle_id` line attributes — we group, run the
 *     shared pricing engine, and emit `update` operations to override
 *     per-unit prices.
 *
 * Both paths can fire in the same call; they don't overlap because a
 * single cart line is either a packaged bundle (path 1) or a
 * components-as-attributes line (path 2).
 */
import { computeBundlePrice, toCents, fromCents } from "./pricing.js";

function bundleIdOf(line) {
  return line && line.mintbundleBundleId ? line.mintbundleBundleId.value : null;
}

function rulesOf(line) {
  if (!line || !line.mintbundleRules || !line.mintbundleRules.value) return [];
  try {
    const parsed = JSON.parse(line.mintbundleRules.value);
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

function eligibilityPayload(line) {
  const product =
    line && line.merchandise && line.merchandise.product
      ? line.merchandise.product
      : null;
  if (!product || !product.eligibilityMetafield) return null;
  try {
    const parsed = JSON.parse(product.eligibilityMetafield.value);
    if (!parsed || typeof parsed !== "object") return null;
    return parsed;
  } catch {
    return null;
  }
}

function inventoryRulesPayload(line) {
  const product =
    line && line.merchandise && line.merchandise.product
      ? line.merchandise.product
      : null;
  if (!product || !product.inventoryRulesMetafield) return null;
  try {
    const parsed = JSON.parse(product.inventoryRulesMetafield.value);
    if (!parsed || typeof parsed !== "object") return null;
    return parsed;
  } catch {
    return null;
  }
}

/**
 * Evaluate per-bundle eligibility against the cart context
 * (M-172b). Returns true if the bundle is allowed; false if
 * the merchant has rules that disqualify the customer for
 * this checkout.
 *
 * Only checks rules the CTF runtime can verify:
 *  - requireLogin       (customer id presence)
 *  - markets            (localization.country.isoCode)
 *  - locales            (localization.language.isoCode)
 *
 * Tag-based gating (`customerTagsAllow` / `customerTagsDeny`)
 * lives in the storefront / theme block layer where the
 * Storefront API exposes the customer's tag list. CTF
 * treats those fields as informational metadata only.
 *
 * @param {object | null} eligibility — parsed eligibility blob.
 * @param {{customerId: string | null, country: string | null, language: string | null}} ctx
 * @returns {boolean}
 */
export function isEligible(eligibility, ctx) {
  if (!eligibility || typeof eligibility !== "object") return true;

  if (eligibility.requireLogin === true) {
    if (!ctx || typeof ctx.customerId !== "string" || ctx.customerId.length === 0) {
      return false;
    }
  }
  if (Array.isArray(eligibility.markets) && eligibility.markets.length > 0) {
    const country = ctx && typeof ctx.country === "string" ? ctx.country : null;
    if (!country || !eligibility.markets.includes(country)) return false;
  }
  if (Array.isArray(eligibility.locales) && eligibility.locales.length > 0) {
    const language = ctx && typeof ctx.language === "string" ? ctx.language : null;
    if (!language || !eligibility.locales.includes(language)) return false;
  }
  return true;
}

/**
 * Decide whether a per-bundle inventory rule blocks the
 * expand path (M-173b). Two checks today:
 *  - componentOnlyMode === true → don't expand. The
 *    merchant has chosen to render components individually
 *    on the storefront, so the cart line is already a
 *    component, not a bundle SKU. Expanding here would
 *    duplicate.
 *  - pauseWhenComponentBelow > 0 with cart-side stock data
 *    is left for storefront enforcement. CTF can't read
 *    inventory levels in real time without a separate
 *    fetch; the field is informational here.
 *
 * @param {object | null} rules
 * @returns {boolean} true → allow expand; false → skip.
 */
export function inventoryAllowsExpand(rules) {
  if (!rules || typeof rules !== "object") return true;
  if (rules.componentOnlyMode === true) return false;
  return true;
}

function ctxFromInput(input) {
  const cart = input && input.cart ? input.cart : null;
  const buyer = cart && cart.buyerIdentity ? cart.buyerIdentity : null;
  const customer = buyer && buyer.customer ? buyer.customer : null;
  const localization = input && input.localization ? input.localization : null;
  return {
    customerId:
      customer && typeof customer.id === "string" ? customer.id : null,
    country:
      localization && localization.country && typeof localization.country.isoCode === "string"
        ? localization.country.isoCode
        : null,
    language:
      localization && localization.language && typeof localization.language.isoCode === "string"
        ? localization.language.isoCode
        : null,
  };
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
 * metafield `mintbundle.cart_default_mode`. Absent or unrecognized
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
    const ctx = ctxFromInput(input);
    for (const line of lines) {
      if (!isBundleProduct(line)) continue;
      const payload = componentsPayload(line);
      if (!payload) continue;
      // M-172b: skip expand when eligibility fails. The line
      // stays as a placeholder bundle product; checkout-guardian
      // can refuse it downstream.
      if (!isEligible(eligibilityPayload(line), ctx)) continue;
      // M-173b: skip expand when componentOnlyMode is on.
      if (!inventoryAllowsExpand(inventoryRulesPayload(line))) continue;
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
