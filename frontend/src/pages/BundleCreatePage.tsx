/**
 * Create-bundle flow.
 *
 * Two steps in one screen:
 *   1. Pick a bundle type from a card grid (each card explains the
 *      use case + customer experience).
 *   2. Name it + save.
 *
 * Server-side `create()` only requires title + type; items and
 * pricing rules default to empty arrays so the new bundle can be
 * fleshed out from the detail page afterwards.
 */
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Banner,
  BlockStack,
  Box,
  Card,
  Grid,
  InlineStack,
  Page,
  TextField,
  Text,
} from "@shopify/polaris";

interface BundleTypeOption {
  id: string;
  label: string;
  tagline: string;
  description: string;
  /** Short customer-facing example so the card communicates intent. */
  example: string;
  /** Background gradient — visual identity per type, no real images yet. */
  gradient: string;
}

const TYPES: BundleTypeOption[] = [
  {
    id: "fixed",
    label: "Fixed bundle",
    tagline: "Curated set, one price",
    description:
      "A static set of products sold together at a flat price.",
    example: "$99 cheese + crackers + jam set",
    gradient: "linear-gradient(135deg, #5b8def 0%, #7e6cf2 100%)",
  },
  {
    id: "mix_match",
    label: "Mix & match",
    tagline: "Customer picks N from M",
    description:
      "Customer chooses any N items from a list. Most popular for variety packs.",
    example: "Pick any 3 candles for $45",
    gradient: "linear-gradient(135deg, #34c486 0%, #29a2c0 100%)",
  },
  {
    id: "bogo",
    label: "BOGO",
    tagline: "Buy one, get one",
    description:
      "Classic promotional bundle with a single qualifier and a discounted reward item.",
    example: "Buy 1 shirt, get 1 free",
    gradient: "linear-gradient(135deg, #f97316 0%, #ef4444 100%)",
  },
  {
    id: "bxgy",
    label: "Buy X get Y",
    tagline: "Cross-sell promo",
    description:
      "Qualifier and reward are different products. Great for complementary cross-sell.",
    example: "Buy a coffee maker, get filters 50% off",
    gradient: "linear-gradient(135deg, #ec4899 0%, #8b5cf6 100%)",
  },
  {
    id: "volume",
    label: "Volume",
    tagline: "Quantity-tier discounts",
    description:
      "Tiered discount on the same product. The more they buy, the more they save.",
    example: "5% off 3+, 10% off 6+, 15% off 12+",
    gradient: "linear-gradient(135deg, #14b8a6 0%, #2563eb 100%)",
  },
  {
    id: "build_box",
    label: "Build a box",
    tagline: "Guided multi-category",
    description:
      "Multi-step picker: choose 1 entrée, 2 sides, 1 drink. Common for meal kits.",
    example: "$45 customizable meal box",
    gradient: "linear-gradient(135deg, #06b6d4 0%, #6366f1 100%)",
  },
  {
    id: "multipack",
    label: "Multipack",
    tagline: "Same SKU at scale",
    description:
      "Single SKU sold in a fixed multiplier with a discounted unit price.",
    example: "12-pack at 15% off",
    gradient: "linear-gradient(135deg, #a855f7 0%, #ec4899 100%)",
  },
  {
    id: "gift",
    label: "Gift",
    tagline: "Threshold reward",
    description:
      "Free or discounted gift triggered by a cart-value threshold.",
    example: "Free gift with $50+ orders",
    gradient: "linear-gradient(135deg, #f43f5e 0%, #f97316 100%)",
  },
  {
    id: "mystery",
    label: "Mystery",
    tagline: "Surprise contents",
    description:
      "Curated bundle whose specific contents you rotate. Customer sees a price + theme only.",
    example: "$35 monthly snack mystery box",
    gradient: "linear-gradient(135deg, #6366f1 0%, #ec4899 100%)",
  },
  {
    id: "sample",
    label: "Sample",
    tagline: "Try-before-you-buy",
    description:
      "Low-cost or free trial set. Common for fragrance, skincare, food brands.",
    example: "5-scent sample for $5",
    gradient: "linear-gradient(135deg, #84cc16 0%, #14b8a6 100%)",
  },
  {
    id: "subscription",
    label: "Subscription",
    tagline: "Recurring with bundle pricing",
    description:
      "Bundle priced for recurring delivery. Works with ReCharge & Bold.",
    example: "Monthly coffee bundle, 15% off",
    gradient: "linear-gradient(135deg, #0ea5e9 0%, #6366f1 100%)",
  },
  {
    id: "wholesale",
    label: "Wholesale",
    tagline: "B2B quantity tiers",
    description:
      "Quantity-priced bundles for B2B. Often gated by Shopify customer tag.",
    example: "Case-pack pricing for tagged customers",
    gradient: "linear-gradient(135deg, #475569 0%, #1e293b 100%)",
  },
  {
    id: "custom",
    label: "Custom",
    tagline: "Escape hatch",
    description:
      "When the 12 above don't fit. Opaque JSON config + a custom rule type.",
    example: "Anything you can write a function for",
    gradient: "linear-gradient(135deg, #64748b 0%, #334155 100%)",
  },
];

interface TypeCardProps {
  option: BundleTypeOption;
  selected: boolean;
  onSelect: () => void;
}

function TypeCard({ option, selected, onSelect }: TypeCardProps): JSX.Element {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      style={{
        // Reset native button styles so we can fully theme the card.
        padding: 0,
        margin: 0,
        border: selected ? "2px solid #2563eb" : "1px solid #e1e3e5",
        borderRadius: 12,
        background: "white",
        cursor: "pointer",
        textAlign: "left",
        width: "100%",
        boxShadow: selected
          ? "0 0 0 4px rgba(37, 99, 235, 0.15)"
          : "0 1px 2px rgba(15, 23, 42, 0.06)",
        transition: "box-shadow 120ms ease, border-color 120ms ease",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          height: 96,
          background: option.gradient,
          display: "flex",
          alignItems: "flex-end",
          padding: "12px 16px",
          color: "white",
          fontWeight: 600,
          fontSize: 14,
          letterSpacing: 0.2,
        }}
      >
        {option.tagline}
      </div>
      <div style={{ padding: "16px" }}>
        <Text as="h3" variant="headingMd">
          {option.label}
        </Text>
        <Box paddingBlockStart="100">
          <Text as="p" tone="subdued">
            {option.description}
          </Text>
        </Box>
        <Box paddingBlockStart="200">
          <Text as="p" variant="bodySm" tone="subdued">
            <em>e.g. {option.example}</em>
          </Text>
        </Box>
      </div>
    </button>
  );
}

export function BundleCreatePage(): JSX.Element {
  const navigate = useNavigate();
  const [type, setType] = useState<string>("fixed");
  const [title, setTitle] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSave(): Promise<void> {
    setError(null);
    if (!title.trim()) {
      setError("Title is required.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/v1/bundles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, type, items: [], pricingRules: [] }),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`HTTP ${res.status}: ${text || res.statusText}`);
      }
      const created = (await res.json()) as { id: string };
      navigate(`/bundles/${created.id}`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  const selected = TYPES.find((t) => t.id === type) ?? TYPES[0];

  return (
    <Page
      title="Create bundle"
      subtitle="Pick a bundle type, give it a name, and you're off."
      backAction={{ content: "Bundles", url: "/" }}
      primaryAction={{
        content: "Save",
        onAction: onSave,
        loading: submitting,
        disabled: submitting,
      }}
    >
      <BlockStack gap="500">
        {error && (
          <Banner tone="critical" title="Could not create bundle">
            {error}
          </Banner>
        )}

        <Card>
          <BlockStack gap="300">
            <Text as="h2" variant="headingMd">
              1. Choose a bundle type
            </Text>
            <Text as="p" tone="subdued">
              Each type maps to a specific buying behavior. Most stores
              start with <strong>Fixed</strong> or <strong>Mix &amp;
              match</strong>; you can always change later.
            </Text>
            <Grid>
              {TYPES.map((opt) => (
                <Grid.Cell
                  key={opt.id}
                  columnSpan={{ xs: 6, sm: 4, md: 3, lg: 3, xl: 3 }}
                >
                  <TypeCard
                    option={opt}
                    selected={opt.id === type}
                    onSelect={() => setType(opt.id)}
                  />
                </Grid.Cell>
              ))}
            </Grid>
          </BlockStack>
        </Card>

        <Card>
          <BlockStack gap="300">
            <Text as="h2" variant="headingMd">
              2. Name it
            </Text>
            <Text as="p" tone="subdued">
              You picked <strong>{selected.label}</strong>. Pick a title
              merchants and customers will recognize.
            </Text>
            <TextField
              label="Title"
              value={title}
              onChange={setTitle}
              autoComplete="off"
              placeholder={`${selected.label} — `}
              requiredIndicator
            />
            <InlineStack gap="200" align="end">
              <Text as="p" tone="subdued" variant="bodySm">
                You can add items, pricing rules, and publish on the next
                screen.
              </Text>
            </InlineStack>
          </BlockStack>
        </Card>
      </BlockStack>
    </Page>
  );
}
