/**
 * Bundle template registry (M-179).
 *
 * Read-only, in-memory list of starter bundles a merchant can
 * clone with one click from the bundle list. Templates carry
 * type + config + pricing rules but **no items** — the merchant
 * adds their own products via ResourcePicker after instantiate.
 * That keeps the registry product-agnostic (no Shopify GIDs to
 * invalidate) and makes "which SKUs?" the merchant's decision.
 *
 * To add a template: append an entry to BUNDLE_TEMPLATES below.
 * Tests in templates.test.ts assert ids are unique and configs
 * round-trip the per-type validators.
 */
import type { BundleType } from "./validators";
import type { CreatePricingRuleInput } from "../../types";

export type TemplateCategory =
  | "promo"
  | "seasonal"
  | "subscription"
  | "starter";

export interface BundleTemplate {
  /** Stable id used in the URL path. */
  id: string;
  /** Shown in the gallery card heading. */
  label: string;
  /** 1–2 sentence pitch shown in the card. */
  description: string;
  /** Filter chip + tone source. */
  category: TemplateCategory;
  /** One of BUNDLE_TYPES — drives downstream config validation. */
  type: BundleType;
  /** Pre-fills the title field on the new draft. */
  defaultTitle: string;
  /** Per-type config object — must match the type's schema. */
  config: Record<string, unknown>;
  /** Pricing rules cloned into the new draft. */
  pricingRules: CreatePricingRuleInput[];
}

export const BUNDLE_TEMPLATES: BundleTemplate[] = [
  {
    id: "holiday-gift-box",
    label: "Holiday gift box",
    description:
      "Curated fixed-bundle scaffold with 15% off — a good fit for a 3-product seasonal gift set.",
    category: "seasonal",
    type: "fixed",
    defaultTitle: "Holiday gift box",
    config: {},
    pricingRules: [
      {
        type: "percentage",
        value: 15,
        minQuantity: 1,
        priority: 10,
        isStackable: false,
      },
    ],
  },
  {
    id: "bogo-weekender",
    label: "BOGO weekender",
    description:
      "Buy-one-get-one-free promo. Sets up the BOGO rule type ready to go — just pick the eligible products.",
    category: "promo",
    type: "bogo",
    defaultTitle: "Buy one, get one free",
    config: {},
    pricingRules: [
      {
        type: "bogo",
        value: 100,
        minQuantity: 2,
        priority: 10,
        isStackable: false,
      },
    ],
  },
  {
    id: "build-a-box-starter",
    label: "Build-a-box starter",
    description:
      "4-step build-a-box with 10% off when the customer completes the box. Ideal for gift/sample boxes.",
    category: "starter",
    type: "build_box",
    defaultTitle: "Build your own box",
    config: {
      minItems: 4,
      maxItems: 4,
      allowDuplicates: false,
      steps: [
        { name: "Pick a base", pickCount: 1 },
        { name: "Add a side", pickCount: 1 },
        { name: "Add a snack", pickCount: 1 },
        { name: "Pick a drink", pickCount: 1 },
      ],
    },
    pricingRules: [
      {
        type: "percentage",
        value: 10,
        minQuantity: 4,
        priority: 10,
        isStackable: false,
      },
    ],
  },
  {
    id: "mix-and-match-trio",
    label: "Mix-and-match trio",
    description:
      "Pick any 3 of the eligible products and save $20 — flexible for category-wide promotions.",
    category: "promo",
    type: "mix_match",
    defaultTitle: "Mix-and-match trio",
    config: {
      minItems: 3,
      maxItems: 3,
      allowDuplicates: true,
    },
    pricingRules: [
      {
        type: "fixed",
        value: 20,
        minQuantity: 3,
        priority: 10,
        isStackable: false,
      },
    ],
  },
  {
    id: "subscription-starter",
    label: "Subscription starter",
    description:
      "Recurring-bundle scaffold for Recharge / Bold integration. Assumes the underlying products are subscription-eligible.",
    category: "subscription",
    type: "subscription",
    defaultTitle: "Monthly subscription bundle",
    config: {},
    pricingRules: [
      {
        type: "percentage",
        value: 10,
        minQuantity: 1,
        priority: 10,
        isStackable: false,
      },
    ],
  },
  {
    id: "volume-tier-starter",
    label: "Volume tier starter",
    description:
      "Three-tier wholesale ladder: 5% at 5 units, 10% at 10, 15% at 25. Drop the rules you don't need.",
    category: "starter",
    type: "volume",
    defaultTitle: "Volume tier bundle",
    config: {},
    pricingRules: [
      {
        type: "volume",
        value: 5,
        minQuantity: 5,
        priority: 10,
        isStackable: false,
      },
      {
        type: "volume",
        value: 10,
        minQuantity: 10,
        priority: 20,
        isStackable: false,
      },
      {
        type: "volume",
        value: 15,
        minQuantity: 25,
        priority: 30,
        isStackable: false,
      },
    ],
  },
];

export function findTemplate(id: string): BundleTemplate | undefined {
  return BUNDLE_TEMPLATES.find((t) => t.id === id);
}
