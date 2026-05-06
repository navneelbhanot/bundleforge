/**
 * Shared bundle-type metadata for the visual UI (create page picker,
 * detail page preview). The 13 types here mirror src/types/index.ts'
 * BundleType union — keep in sync.
 */

export interface BundleTypeOption {
  id: string;
  label: string;
  tagline: string;
  description: string;
  /** Short customer-facing example so the card communicates intent. */
  example: string;
  /** Background gradient — visual identity per type. */
  gradient: string;
  /** Hint for the storefront preview's layout + default discount badge. */
  preview: {
    badgeText: string;
    items: number;
    layout: "stack" | "grid" | "stepper";
  };
}

export const BUNDLE_TYPE_OPTIONS: BundleTypeOption[] = [
  {
    id: "fixed",
    label: "Fixed bundle",
    tagline: "Curated set, one price",
    description: "A static set of products sold together at a flat price.",
    example: "$99 cheese + crackers + jam set",
    gradient: "linear-gradient(135deg, #5b8def 0%, #7e6cf2 100%)",
    preview: { badgeText: "Save 25%", items: 3, layout: "stack" },
  },
  {
    id: "mix_match",
    label: "Mix & match",
    tagline: "Customer picks N from M",
    description:
      "Customer chooses any N items from a list. Most popular for variety packs.",
    example: "Pick any 3 candles for $45",
    gradient: "linear-gradient(135deg, #34c486 0%, #29a2c0 100%)",
    preview: { badgeText: "Pick any 3", items: 6, layout: "grid" },
  },
  {
    id: "bogo",
    label: "BOGO",
    tagline: "Buy one, get one",
    description:
      "Classic promotional bundle with a single qualifier and a discounted reward item.",
    example: "Buy 1 shirt, get 1 free",
    gradient: "linear-gradient(135deg, #f97316 0%, #ef4444 100%)",
    preview: { badgeText: "Buy 1, get 1 FREE", items: 2, layout: "stack" },
  },
  {
    id: "bxgy",
    label: "Buy X get Y",
    tagline: "Cross-sell promo",
    description:
      "Qualifier and reward are different products. Great for complementary cross-sell.",
    example: "Buy a coffee maker, get filters 50% off",
    gradient: "linear-gradient(135deg, #ec4899 0%, #8b5cf6 100%)",
    preview: { badgeText: "Add Y for 50% off", items: 2, layout: "stack" },
  },
  {
    id: "volume",
    label: "Volume",
    tagline: "Quantity-tier discounts",
    description:
      "Tiered discount on the same product. The more they buy, the more they save.",
    example: "5% off 3+, 10% off 6+, 15% off 12+",
    gradient: "linear-gradient(135deg, #14b8a6 0%, #2563eb 100%)",
    preview: {
      badgeText: "More you buy, more you save",
      items: 1,
      layout: "stack",
    },
  },
  {
    id: "build_box",
    label: "Build a box",
    tagline: "Guided multi-category",
    description:
      "Multi-step picker: choose 1 entrée, 2 sides, 1 drink. Common for meal kits.",
    example: "$45 customizable meal box",
    gradient: "linear-gradient(135deg, #06b6d4 0%, #6366f1 100%)",
    preview: { badgeText: "Build your box", items: 4, layout: "stepper" },
  },
  {
    id: "multipack",
    label: "Multipack",
    tagline: "Same SKU at scale",
    description:
      "Single SKU sold in a fixed multiplier with a discounted unit price.",
    example: "12-pack at 15% off",
    gradient: "linear-gradient(135deg, #a855f7 0%, #ec4899 100%)",
    preview: { badgeText: "Multipack savings", items: 1, layout: "stack" },
  },
  {
    id: "gift",
    label: "Gift",
    tagline: "Threshold reward",
    description:
      "Free or discounted gift triggered by a cart-value threshold.",
    example: "Free gift with $50+ orders",
    gradient: "linear-gradient(135deg, #f43f5e 0%, #f97316 100%)",
    preview: { badgeText: "Free gift", items: 2, layout: "stack" },
  },
  {
    id: "mystery",
    label: "Mystery",
    tagline: "Surprise contents",
    description:
      "Curated bundle whose specific contents you rotate. Customer sees a price + theme only.",
    example: "$35 monthly snack mystery box",
    gradient: "linear-gradient(135deg, #6366f1 0%, #ec4899 100%)",
    preview: { badgeText: "Mystery box", items: 1, layout: "stack" },
  },
  {
    id: "sample",
    label: "Sample",
    tagline: "Try-before-you-buy",
    description:
      "Low-cost or free trial set. Common for fragrance, skincare, food brands.",
    example: "5-scent sample for $5",
    gradient: "linear-gradient(135deg, #84cc16 0%, #14b8a6 100%)",
    preview: { badgeText: "Sample set", items: 5, layout: "grid" },
  },
  {
    id: "subscription",
    label: "Subscription",
    tagline: "Recurring with bundle pricing",
    description:
      "Bundle priced for recurring delivery. Works with ReCharge & Bold.",
    example: "Monthly coffee bundle, 15% off",
    gradient: "linear-gradient(135deg, #0ea5e9 0%, #6366f1 100%)",
    preview: { badgeText: "Subscribe & save", items: 3, layout: "stack" },
  },
  {
    id: "wholesale",
    label: "Wholesale",
    tagline: "B2B quantity tiers",
    description:
      "Quantity-priced bundles for B2B. Often gated by Shopify customer tag.",
    example: "Case-pack pricing for tagged customers",
    gradient: "linear-gradient(135deg, #475569 0%, #1e293b 100%)",
    preview: { badgeText: "Wholesale tier", items: 1, layout: "stack" },
  },
  {
    id: "custom",
    label: "Custom",
    tagline: "Escape hatch",
    description:
      "When the 12 above don't fit. Opaque JSON config + a custom rule type.",
    example: "Anything you can write a function for",
    gradient: "linear-gradient(135deg, #64748b 0%, #334155 100%)",
    preview: { badgeText: "Custom bundle", items: 2, layout: "stack" },
  },
];

export function findBundleType(id: string): BundleTypeOption {
  return (
    BUNDLE_TYPE_OPTIONS.find((t) => t.id === id) ?? BUNDLE_TYPE_OPTIONS[0]
  );
}
