import { PrismaClient } from "../src/generated/prisma";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding database...");

  // Create a test shop for development
  const shop = await prisma.shop.upsert({
    where: { shopifyDomain: "bundleforge-dev.myshopify.com" },
    update: {},
    create: {
      shopifyDomain: "bundleforge-dev.myshopify.com",
      shopifyGid: "gid://shopify/Shop/1",
      accessToken: "dev_token_placeholder",
      name: "BundleForge Dev Store",
      email: "dev@bundleforge.io",
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
