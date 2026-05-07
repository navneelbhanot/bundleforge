/**
 * Plan order-cap enforcement (M-200).
 *
 * Counts a shop's distinct Shopify bundle orders in the current
 * calendar month (UTC) and decides whether the shop has exhausted
 * its plan's `maxOrdersPerMonth` budget.
 *
 * Today only the `starter` plan has a non-null cap (100). Growth /
 * Pro / Enterprise are `null` and the helper returns
 * `{ over: false }` immediately, which preserves the flat-rate
 * pricing promise on paid tiers (PRODUCT_PLAN.md §6).
 *
 * The count uses `BundleOrder.shopifyOrderId` (Shopify's order id),
 * not `BundleOrder.id` — a single Shopify order with two different
 * bundles writes two `BundleOrder` rows but counts as ONE order
 * against the cap. That matches the merchant-facing meaning of
 * "100 orders/mo".
 */
import type { PlanName } from "./plans";
import { PLAN_CAPS, planFor } from "./plans";

export interface OrderCapStatus {
  /** True when the shop has reached or exceeded its monthly cap. */
  over: boolean;
  /** Plan cap (null = unlimited; only Starter has a finite cap today). */
  cap: number | null;
  /** Distinct Shopify orders observed this calendar month (UTC). */
  count: number;
  /** Resolved plan for the shop. */
  plan: PlanName;
}

/**
 * Minimal Prisma surface this module needs. Defining it locally
 * keeps `orderCap` decoupled from the full PrismaClient type so
 * tests can pass a hand-rolled stub without satisfying every
 * delegate method.
 */
export interface OrderCapPrisma {
  bundleOrder: {
    findMany(args: {
      where: {
        shopId: string;
        createdAt: { gte: Date };
      };
      distinct: ["shopifyOrderId"];
      select: { shopifyOrderId: true };
    }): Promise<Array<{ shopifyOrderId: bigint }>>;
  };
}

/**
 * Start of the calendar month containing `now`, in UTC.
 *
 * UTC-aligned because Shopify billing periods are UTC and the
 * small per-shop timezone skew (a few hours) isn't worth the
 * complexity of pulling Shop.timezone into a hot pre-checkout
 * path. Documented in M-200's spec.
 */
export function startOfMonthUtc(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0));
}

/**
 * Count of distinct Shopify orders carrying a bundle for `shopId`
 * since the start of the current calendar month (UTC).
 *
 * Counting at the Shopify-order level (not BundleOrder rows) means
 * a multi-bundle cart counts once, matching the merchant-facing
 * "orders per month" meaning.
 */
export async function currentMonthBundleOrderCount(
  prisma: OrderCapPrisma,
  shopId: string,
  now: Date,
): Promise<number> {
  const since = startOfMonthUtc(now);
  const rows = await prisma.bundleOrder.findMany({
    where: {
      shopId,
      createdAt: { gte: since },
    },
    distinct: ["shopifyOrderId"],
    select: { shopifyOrderId: true },
  });
  return rows.length;
}

/**
 * Decide whether a shop has reached/exceeded its monthly bundle-order
 * cap.
 *
 * Plans with `maxOrdersPerMonth: null` (Growth/Pro/Enterprise today)
 * short-circuit to `{ over: false, cap: null, count: 0 }` without
 * hitting the database.
 */
export async function isOverOrderCap(
  prisma: OrderCapPrisma,
  shop: { id: string; planName: string },
  now: Date,
): Promise<OrderCapStatus> {
  const plan = planFor(shop.planName);
  const cap = PLAN_CAPS[plan].maxOrdersPerMonth;
  if (cap === null) {
    return { over: false, cap: null, count: 0, plan };
  }
  const count = await currentMonthBundleOrderCount(prisma, shop.id, now);
  return { over: count >= cap, cap, count, plan };
}
