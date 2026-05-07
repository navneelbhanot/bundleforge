/**
 * End-to-end order flow integration test.
 *
 * What this test verifies:
 *
 *   1. ordersCreate handler picks up the bundle marker
 *      (`_mintbundle_bundle_id`) on a Shopify order line item.
 *   2. A BundleOrder row is persisted with the right shop FK,
 *      bundle FK, prices, and SKU breakdown.
 *   3. Non-bundle line items are ignored (no BundleOrder row).
 *   4. Multi-quantity bundles persist with the right line-item shape.
 *
 * What this test does NOT verify (and why):
 *
 *   The inventory adjustment chain is gated on
 *   `bundle.inventoryItemGid` + `bundle.locationGid`, both of which
 *   are hardcoded `null` in src/webhooks/handlers/ordersCreate.ts:92
 *   until the bigger M-051 work lands (`publish()` actually creates
 *   a Shopify product, which gives us a real inventoryItem GID per
 *   component). So in production today, no inventory_audit_log row
 *   is written from a real Shopify order — the path exists but is
 *   unreachable. This is the known #1 gap from session 0157+ STATE.md.
 *
 *   The pure inventory engine (applyAdjustment) IS unit-tested in
 *   src/services/inventory/index.test.ts and the property test in
 *   tests/property/inventory.concurrency.test.ts. What's missing is
 *   the wiring; the engine itself works.
 *
 * Auto-skips when DATABASE_URL is missing or fake.
 */
import crypto from "node:crypto";

import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
} from "vitest";

import { prisma } from "../../src/config/database";
import { ordersCreateHandler } from "../../src/webhooks/handlers/ordersCreate";

const RUN_TAG = crypto.randomBytes(4).toString("hex");
const SHOP = `e2e-order-${RUN_TAG}.myshopify.com`;

let dbAvailable = false;
let createdShopId: string | null = null;
let createdBundleId: string | null = null;

beforeAll(async () => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    dbAvailable = true;
  } catch {
    dbAvailable = false;
    return;
  }

  const shop = await prisma.shop.upsert({
    where: { shopifyDomain: SHOP },
    update: { uninstalledAt: null },
    create: {
      shopifyDomain: SHOP,
      shopifyGid: `gid://shopify/Shop/${SHOP}`,
      accessToken: "encrypted-placeholder",
      name: SHOP,
      email: `support+${RUN_TAG}@example.com`,
    },
  });
  createdShopId = shop.id;

  const bundle = await prisma.bundle.create({
    data: {
      shopId: shop.id,
      title: "E2E Order Flow Bundle",
      slug: `e2e-order-${RUN_TAG}`,
      type: "fixed",
      status: "active",
      config: {},
      displaySettings: {},
      items: {
        create: [
          {
            shopifyProductGid: `gid://shopify/Product/100${RUN_TAG}A`,
            shopifyVariantGid: `gid://shopify/ProductVariant/100${RUN_TAG}A`,
            sku: `E2E-A-${RUN_TAG}`,
            title: "Component A",
            quantity: 1,
            position: 0,
          },
          {
            shopifyProductGid: `gid://shopify/Product/100${RUN_TAG}B`,
            shopifyVariantGid: `gid://shopify/ProductVariant/100${RUN_TAG}B`,
            sku: `E2E-B-${RUN_TAG}`,
            title: "Component B",
            quantity: 2, // 2 units of B per bundle
            position: 1,
          },
        ],
      },
    },
  });
  createdBundleId = bundle.id;
});

afterAll(async () => {
  if (!dbAvailable || !createdShopId) return;
  await prisma.bundleOrder.deleteMany({ where: { shopId: createdShopId } });
  await prisma.bundle.deleteMany({ where: { shopId: createdShopId } });
  await prisma.shop.delete({ where: { id: createdShopId } }).catch(() => undefined);
});

afterEach(async () => {
  if (!dbAvailable || !createdShopId) return;
  await prisma.bundleOrder.deleteMany({ where: { shopId: createdShopId } });
});

describe.skipIf(
  !process.env.DATABASE_URL || process.env.DATABASE_URL.includes("localhost:5432/test"),
)("Order webhook → BundleOrder persistence (full DB chain)", () => {
  it("persists a BundleOrder for a 1-bundle order with correct SKU breakdown", async () => {
    if (!dbAvailable || !createdBundleId || !createdShopId) return;
    const handler = ordersCreateHandler();
    const orderId = Date.now();
    await handler({
      shopDomain: SHOP,
      payload: {
        id: orderId,
        admin_graphql_api_id: `gid://shopify/Order/${orderId}`,
        name: `#1001-${RUN_TAG}`,
        number: 1001,
        currency: "USD",
        line_items: [
          {
            id: 9001,
            title: "E2E Order Flow Bundle",
            quantity: 1,
            price: "79.00",
            properties: [
              { name: "_mintbundle_bundle_id", value: createdBundleId },
            ],
          },
        ],
      } as Record<string, unknown>,
      webhookId: `wh-test-${RUN_TAG}-1`,
      topic: "orders/create",
      apiVersion: "2025-01",
    });

    const orders = await prisma.bundleOrder.findMany({
      where: { shopId: createdShopId, bundleId: createdBundleId },
    });
    expect(orders, "exactly one BundleOrder per webhook").toHaveLength(1);
    expect(orders[0]).toMatchObject({
      status: "processed",
      shopifyOrderNumber: `#1001-${RUN_TAG}`,
      currency: "USD",
    });
    expect(orders[0].bundlePrice.toString()).toBe("79");

    // SKU breakdown for 1 bundle: 1 of A, 2 of B (per bundle items).
    const breakdown = orders[0].skuBreakdown as Array<{ sku: string; quantity: number }>;
    expect(breakdown.find((s) => s.sku === `E2E-A-${RUN_TAG}`)?.quantity).toBe(1);
    expect(breakdown.find((s) => s.sku === `E2E-B-${RUN_TAG}`)?.quantity).toBe(2);
  });

  it("scales the SKU breakdown with order quantity (3 bundles)", async () => {
    if (!dbAvailable || !createdBundleId || !createdShopId) return;
    const handler = ordersCreateHandler();
    const orderId = Date.now() + 1;
    await handler({
      shopDomain: SHOP,
      payload: {
        id: orderId,
        admin_graphql_api_id: `gid://shopify/Order/${orderId}`,
        name: `#1002-${RUN_TAG}`,
        number: 1002,
        currency: "USD",
        line_items: [
          {
            id: 9002,
            title: "E2E Order Flow Bundle",
            quantity: 3,
            price: "237.00",
            properties: [
              { name: "_mintbundle_bundle_id", value: createdBundleId },
            ],
          },
        ],
      } as Record<string, unknown>,
      webhookId: `wh-test-${RUN_TAG}-2`,
      topic: "orders/create",
      apiVersion: "2025-01",
    });
    const orders = await prisma.bundleOrder.findMany({
      where: { shopId: createdShopId, bundleId: createdBundleId },
    });
    const breakdown = orders[0].skuBreakdown as Array<{ sku: string; quantity: number }>;
    // 3 bundles × 1 of A = 3, 3 × 2 of B = 6
    expect(breakdown.find((s) => s.sku === `E2E-A-${RUN_TAG}`)?.quantity).toBe(3);
    expect(breakdown.find((s) => s.sku === `E2E-B-${RUN_TAG}`)?.quantity).toBe(6);
  });

  it("ignores non-bundle line items (no marker = no BundleOrder)", async () => {
    if (!dbAvailable || !createdShopId) return;
    const handler = ordersCreateHandler();
    const orderId = Date.now() + 2;
    await handler({
      shopDomain: SHOP,
      payload: {
        id: orderId,
        admin_graphql_api_id: `gid://shopify/Order/${orderId}`,
        name: `#1003-${RUN_TAG}`,
        currency: "USD",
        line_items: [
          {
            id: 9003,
            title: "Plain product, no bundle",
            quantity: 1,
            price: "10.00",
            // no properties[] with the bundle marker
          },
        ],
      } as Record<string, unknown>,
      webhookId: `wh-test-${RUN_TAG}-3`,
      topic: "orders/create",
      apiVersion: "2025-01",
    });
    const orders = await prisma.bundleOrder.findMany({
      where: { shopId: createdShopId },
    });
    expect(orders, "non-bundle order should NOT create a BundleOrder row").toHaveLength(0);
  });

  it("handles unknown bundle marker gracefully (no row, no throw)", async () => {
    if (!dbAvailable || !createdShopId) return;
    const handler = ordersCreateHandler();
    const orderId = Date.now() + 3;
    await handler({
      shopDomain: SHOP,
      payload: {
        id: orderId,
        admin_graphql_api_id: `gid://shopify/Order/${orderId}`,
        name: `#1004-${RUN_TAG}`,
        currency: "USD",
        line_items: [
          {
            id: 9004,
            title: "Order references a deleted bundle",
            quantity: 1,
            price: "0",
            properties: [
              {
                name: "_mintbundle_bundle_id",
                value: "00000000-0000-0000-0000-000000000000",
              },
            ],
          },
        ],
      } as Record<string, unknown>,
      webhookId: `wh-test-${RUN_TAG}-4`,
      topic: "orders/create",
      apiVersion: "2025-01",
    });
    const orders = await prisma.bundleOrder.findMany({
      where: { shopId: createdShopId },
    });
    expect(orders, "unknown bundle id should be logged + skipped, not crash").toHaveLength(0);
  });
});
