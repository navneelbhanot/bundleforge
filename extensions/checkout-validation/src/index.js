/**
 * Checkout Validation Function (M-087, Plus-only).
 *
 * Shopify Validation Functions can BLOCK checkout (vs Cart Transform
 * which only adjusts pricing). Available on Shopify Plus.
 *
 * For non-Plus stores this Function is not deployed; the Checkout
 * Guardian (M-086, /api/proxy/validate-cart) provides the equivalent
 * pre-checkout signal in the storefront block.
 */

/**
 * Group lines by bundle id; for each bundle, sum quantities and check
 * against min/max attributes. Emit one error per failing bundle.
 */
export function run(input) {
  const lines = (input && input.cart && input.cart.lines) || [];
  const groups = new Map();
  for (const line of lines) {
    const idAttr = line.bundleforgeBundleId;
    if (!idAttr || !idAttr.value) continue;
    const id = idAttr.value;
    if (!groups.has(id)) groups.set(id, { lines: [], min: null, max: null });
    const g = groups.get(id);
    g.lines.push(line);
    if (line.bundleforgeMin && line.bundleforgeMin.value && g.min === null) {
      g.min = parseInt(line.bundleforgeMin.value, 10);
    }
    if (line.bundleforgeMax && line.bundleforgeMax.value && g.max === null) {
      g.max = parseInt(line.bundleforgeMax.value, 10);
    }
  }

  const errors = [];
  for (const [bundleId, g] of groups) {
    const qty = g.lines.reduce((s, l) => s + (l.quantity || 0), 0);
    if (g.min !== null && qty < g.min) {
      errors.push({
        message: `Bundle ${bundleId} requires at least ${g.min} items`,
        target: "$.cart",
      });
    }
    if (g.max !== null && qty > g.max) {
      errors.push({
        message: `Bundle ${bundleId} allows at most ${g.max} items`,
        target: "$.cart",
      });
    }
  }

  return { errors };
}

export default { run };
