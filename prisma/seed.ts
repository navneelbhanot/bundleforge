import { PrismaClient } from "../src/generated/prisma";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding database...");

  // Create a test shop for development
  const shop = await prisma.shop.upsert({
    where: { shopifyDomain: "mintbundle-dev.myshopify.com" },
    update: {},
    create: {
      shopifyDomain: "mintbundle-dev.myshopify.com",
      shopifyGid: "gid://shopify/Shop/1",
      accessToken: "dev_token_placeholder",
      name: "MintBundle Dev Store",
      email: "dev@mintbundle.io",
      planName: "enterprise",
      shopifyPlan: "development",
      currency: "USD",
      timezone: "America/New_York",
      locale: "en",
      settings: {
        safetyLock: false,
        notifications: { email: true, inApp: true },
      },
    },
  });

  console.log(`Created shop: ${shop.name} (${shop.id})`);

  // Create sample bundles
  const sampleBundle = await prisma.bundle.create({
    data: {
      shopId: shop.id,
      title: "Summer Starter Kit",
      slug: "summer-starter-kit",
      type: "fixed",
      status: "draft",
      description: "Everything you need to get started this summer",
      config: { minItems: 3, maxItems: 5 },
      displaySettings: { layout: "grid", showComparePrice: true },
      items: {
        create: [
          { shopifyProductGid: "gid://shopify/Product/1", title: "Sunscreen SPF 50", sku: "SUN-001", quantity: 1, position: 0 },
          { shopifyProductGid: "gid://shopify/Product/2", title: "Beach Towel", sku: "TWL-001", quantity: 1, position: 1 },
          { shopifyProductGid: "gid://shopify/Product/3", title: "Water Bottle", sku: "WTR-001", quantity: 1, position: 2 },
        ],
      },
      pricingRules: {
        create: [
          { type: "percentage", value: 15.00, minQuantity: 1 },
        ],
      },
    },
  });

  console.log(`Created bundle: ${sampleBundle.title} (${sampleBundle.id})`);

  // Create a mix-and-match bundle
  const mixMatchBundle = await prisma.bundle.create({
    data: {
      shopId: shop.id,
      title: "Build Your Own Box",
      slug: "build-your-own-box",
      type: "build_box",
      status: "draft",
      description: "Pick any 4 items and save 20%",
      config: { minItems: 4, maxItems: 4, allowDuplicates: false },
      items: {
        create: [
          { shopifyProductGid: "gid://shopify/Product/10", title: "Item A", quantity: 1, position: 0, isRequired: false, groupName: "Step 1: Pick a flavor" },
          { shopifyProductGid: "gid://shopify/Product/11", title: "Item B", quantity: 1, position: 1, isRequired: false, groupName: "Step 1: Pick a flavor" },
          { shopifyProductGid: "gid://shopify/Product/12", title: "Item C", quantity: 1, position: 2, isRequired: false, groupName: "Step 2: Pick a size" },
          { shopifyProductGid: "gid://shopify/Product/13", title: "Item D", quantity: 1, position: 3, isRequired: false, groupName: "Step 2: Pick a size" },
        ],
      },
      pricingRules: {
        create: [
          { type: "percentage", value: 20.00, minQuantity: 4 },
        ],
      },
    },
  });

  console.log(`Created bundle: ${mixMatchBundle.title} (${mixMatchBundle.id})`);

  // Volume bundle
  const volumeBundle = await prisma.bundle.create({
    data: {
      shopId: shop.id,
      title: "Bulk Stationery",
      slug: "bulk-stationery",
      type: "volume",
      status: "draft",
      description: "More you buy, more you save",
      config: {},
      items: {
        create: [
          {
            shopifyProductGid: "gid://shopify/Product/20",
            title: "Notebook",
            sku: "NB-001",
            quantity: 1,
            position: 0,
          },
        ],
      },
      pricingRules: {
        create: [
          { type: "tiered", value: 5, minQuantity: 3, priority: 1 },
          { type: "tiered", value: 10, minQuantity: 5, priority: 2 },
          { type: "tiered", value: 20, minQuantity: 10, priority: 3 },
        ],
      },
    },
  });
  console.log(`Created bundle: ${volumeBundle.title} (${volumeBundle.id})`);

  // M-151 — additional demo bundles spanning the remaining bundle types,
  // plus a few demo orders + audit-log rows so the analytics dashboard
  // and inventory-audit page have something to render.
  const bogoBundle = await prisma.bundle.create({
    data: {
      shopId: shop.id,
      title: "Buy 2 Get 1 Tee",
      slug: "buy-2-get-1-tee",
      type: "bogo",
      status: "active",
      description: "Buy any 2 tees, get the 3rd free.",
      config: { buyQuantity: 2, getQuantity: 1 },
      items: {
        create: [
          { shopifyProductGid: "gid://shopify/Product/30", title: "Crew Tee", sku: "TEE-001", quantity: 1, position: 0 },
        ],
      },
      pricingRules: {
        create: [{ type: "bogo", value: 100, minQuantity: 3, priority: 1 }],
      },
    },
  });
  console.log(`Created bundle: ${bogoBundle.title}`);

  const bxgyBundle = await prisma.bundle.create({
    data: {
      shopId: shop.id,
      title: "Buy 3 Save 25%",
      slug: "buy-3-save-25",
      type: "bxgy",
      status: "active",
      description: "Mix-and-match: buy any 3 items in this collection.",
      config: { buyQuantity: 3 },
      items: {
        create: [
          { shopifyProductGid: "gid://shopify/Product/40", title: "Soap", sku: "SOAP-1", quantity: 1, position: 0 },
          { shopifyProductGid: "gid://shopify/Product/41", title: "Lotion", sku: "LOT-1", quantity: 1, position: 1 },
          { shopifyProductGid: "gid://shopify/Product/42", title: "Shampoo", sku: "SHM-1", quantity: 1, position: 2 },
        ],
      },
      pricingRules: {
        create: [{ type: "percentage", value: 25, minQuantity: 3 }],
      },
    },
  });
  console.log(`Created bundle: ${bxgyBundle.title}`);

  const multipack = await prisma.bundle.create({
    data: {
      shopId: shop.id,
      title: "Coffee Beans 6-pack",
      slug: "coffee-6pack",
      type: "multipack",
      status: "active",
      description: "Six bags of single-origin beans, 10% off.",
      config: { packQuantity: 6 },
      items: {
        create: [
          { shopifyProductGid: "gid://shopify/Product/50", title: "Coffee Beans 250g", sku: "COF-250", quantity: 6, position: 0 },
        ],
      },
      pricingRules: {
        create: [{ type: "percentage", value: 10, minQuantity: 6 }],
      },
    },
  });
  console.log(`Created bundle: ${multipack.title}`);

  const subBundle = await prisma.bundle.create({
    data: {
      shopId: shop.id,
      title: "Coffee Subscription — Monthly",
      slug: "coffee-sub-monthly",
      type: "subscription",
      status: "active",
      description: "Auto-ship 2 bags every 30 days, 15% off.",
      config: { intervalDays: 30, sellingPlanGid: "gid://shopify/SellingPlan/1" },
      items: {
        create: [
          { shopifyProductGid: "gid://shopify/Product/50", title: "Coffee Beans 250g", sku: "COF-250", quantity: 2, position: 0 },
        ],
      },
      pricingRules: {
        create: [{ type: "percentage", value: 15, minQuantity: 1 }],
      },
    },
  });
  console.log(`Created bundle: ${subBundle.title}`);

  // A few demo orders so analytics has data to render.
  const now = Date.now();
  for (let i = 0; i < 6; i++) {
    await prisma.bundleOrder.create({
      data: {
        shopId: shop.id,
        bundleId: i % 2 === 0 ? sampleBundle.id : mixMatchBundle.id,
        shopifyOrderGid: `gid://shopify/Order/demo-${i}`,
        shopifyOrderId: BigInt(1000 + i),
        shopifyOrderNumber: `#${1001 + i}`,
        status: "processed",
        bundlePrice: 42.0,
        originalPrice: 49.0,
        discountAmount: 7.0,
        currency: "USD",
        lineItems: [
          { sku: "SUN-001", title: "Sunscreen SPF 50", quantity: 1, unitPriceCents: 1500 },
        ],
        skuBreakdown: [{ sku: "SUN-001", quantity: 1 }],
        metadata: { variant: i % 2 === 0 ? "A" : "B" },
        createdAt: new Date(now - i * 86_400_000),
      },
    });
  }
  console.log("Created 6 demo BundleOrders");

  // Audit-log rows for the inventory page.
  for (let i = 0; i < 4; i++) {
    await prisma.inventoryAuditLog.create({
      data: {
        shopId: shop.id,
        bundleId: sampleBundle.id,
        shopifyInventoryItemGid: "gid://shopify/InventoryItem/1",
        locationGid: "gid://shopify/Location/1",
        action: "adjust",
        quantityBefore: 100 - i,
        quantityAfter: 99 - i,
        quantityDelta: -1,
        reason: "order_placed",
        source: "webhook",
        referenceId: `demo-${i}`,
      },
    });
  }
  console.log("Created 4 demo audit-log rows");

  // Billing subscription on the dev shop
  await prisma.billingSubscription.upsert({
    where: { shopId: shop.id },
    update: {},
    create: {
      shopId: shop.id,
      shopifyChargeId: "gid://shopify/AppSubscription/0",
      planName: "enterprise",
      price: 0,
      billingInterval: "monthly",
      status: "active",
      activatedAt: new Date(),
    },
  });
  console.log("Created billing_subscription for dev shop");

  console.log("Seeding complete!");
}

main()
  .catch((e) => {
    console.error("Seed error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
