/**
 * Create-bundle flow.
 *
 * Two-column layout:
 *   - LEFT  — chosen type summary (with "Change type" → modal of all 13),
 *             title, description.
 *   - RIGHT — live storefront preview that updates as the merchant edits.
 *
 * Server-side `create()` only requires title + type; items and pricing
 * rules default to empty arrays so the new bundle can be fleshed out
 * from the detail page after save.
 */
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Banner,
  BlockStack,
  Box,
  Button,
  Card,
  Grid,
  InlineStack,
  Layout,
  Modal,
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
  /** What the storefront preview should show for this type. */
  preview: {
    badgeText: string;
    items: number;
    layout: "stack" | "grid" | "stepper";
  };
}

const TYPES: BundleTypeOption[] = [
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
    preview: { badgeText: "More you buy, more you save", items: 1, layout: "stack" },
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
    description: "Free or discounted gift triggered by a cart-value threshold.",
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
    description: "Bundle priced for recurring delivery. Works with ReCharge & Bold.",
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
          height: 72,
          background: option.gradient,
          display: "flex",
          alignItems: "flex-end",
          padding: "10px 14px",
          color: "white",
          fontWeight: 600,
          fontSize: 13,
          letterSpacing: 0.2,
        }}
      >
        {option.tagline}
      </div>
      <div style={{ padding: "12px 14px" }}>
        <Text as="h3" variant="headingSm">
          {option.label}
        </Text>
        <Box paddingBlockStart="100">
          <Text as="p" variant="bodySm" tone="subdued">
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

interface PreviewProps {
  type: BundleTypeOption;
  title: string;
  description: string;
}

function StorefrontPreview({ type, title, description }: PreviewProps): JSX.Element {
  const displayTitle = title.trim() || `Untitled ${type.label.toLowerCase()}`;
  const items = Array.from({ length: type.preview.items }, (_, i) => ({
    id: i,
    label: `Item ${i + 1}`,
  }));

  return (
    <Card>
      <BlockStack gap="200">
        <Text as="h3" variant="headingSm">
          Storefront preview
        </Text>
        <Text as="p" variant="bodySm" tone="subdued">
          How this bundle appears on a customer's product page once
          published. Updates live as you edit.
        </Text>

        <Box
          background="bg-surface-secondary"
          padding="400"
          borderRadius="300"
          borderWidth="025"
          borderColor="border"
        >
          {/* Hero: gradient banner labelled with the bundle title. */}
          <div
            style={{
              height: 96,
              background: type.gradient,
              borderRadius: 8,
              display: "flex",
              alignItems: "flex-end",
              padding: "12px 16px",
              color: "white",
            }}
          >
            <BlockStack gap="050">
              <Text as="span" variant="bodySm">
                <span style={{ color: "rgba(255,255,255,0.85)" }}>
                  {type.preview.badgeText}
                </span>
              </Text>
              <Text as="span" variant="headingMd">
                <span style={{ color: "white" }}>{displayTitle}</span>
              </Text>
            </BlockStack>
          </div>

          {/* Description if provided. */}
          {description.trim() && (
            <Box paddingBlockStart="300">
              <Text as="p" tone="subdued">
                {description}
              </Text>
            </Box>
          )}

          {/* Items mock. Layout depends on the type's preview hint. */}
          <Box paddingBlockStart="300">
            {type.preview.layout === "grid" ? (
              <Grid>
                {items.map((it) => (
                  <Grid.Cell key={it.id} columnSpan={{ xs: 3, sm: 2, md: 2, lg: 2, xl: 2 }}>
                    <div
                      style={{
                        background: "white",
                        border: "1px solid #e1e3e5",
                        borderRadius: 8,
                        padding: 12,
                        textAlign: "center",
                        minHeight: 60,
                      }}
                    >
                      <div
                        style={{
                          height: 28,
                          background:
                            "linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%)",
                          borderRadius: 4,
                          marginBottom: 6,
                        }}
                      />
                      <Text as="span" variant="bodySm" tone="subdued">
                        {it.label}
                      </Text>
                    </div>
                  </Grid.Cell>
                ))}
              </Grid>
            ) : type.preview.layout === "stepper" ? (
              <BlockStack gap="200">
                {items.map((it, i) => (
                  <div
                    key={it.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      padding: 10,
                      background: "white",
                      border: "1px solid #e1e3e5",
                      borderRadius: 8,
                    }}
                  >
                    <span
                      style={{
                        width: 24,
                        height: 24,
                        borderRadius: 999,
                        background: "#2563eb",
                        color: "white",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 12,
                        fontWeight: 600,
                      }}
                    >
                      {i + 1}
                    </span>
                    <Text as="span" tone="subdued">
                      Step {i + 1}: choose your {it.label.toLowerCase()}
                    </Text>
                  </div>
                ))}
              </BlockStack>
            ) : (
              <BlockStack gap="200">
                {items.map((it) => (
                  <div
                    key={it.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      padding: 10,
                      background: "white",
                      border: "1px solid #e1e3e5",
                      borderRadius: 8,
                    }}
                  >
                    <div
                      style={{
                        width: 40,
                        height: 40,
                        background:
                          "linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%)",
                        borderRadius: 6,
                      }}
                    />
                    <Text as="span" tone="subdued">
                      {it.label}
                    </Text>
                  </div>
                ))}
              </BlockStack>
            )}
          </Box>

          {/* Mock CTA. */}
          <Box paddingBlockStart="300">
            <button
              type="button"
              disabled
              aria-disabled
              style={{
                width: "100%",
                padding: "10px 16px",
                background: "#1a1a1a",
                color: "white",
                border: "none",
                borderRadius: 6,
                fontWeight: 600,
                fontSize: 14,
                cursor: "not-allowed",
                opacity: 0.95,
              }}
            >
              Add bundle to cart
            </button>
          </Box>
        </Box>

        <Text as="p" variant="bodySm" tone="subdued">
          Items, real images, and the discount badge are placeholders.
          Configure them on the next screen.
        </Text>
      </BlockStack>
    </Card>
  );
}

export function BundleCreatePage(): JSX.Element {
  const navigate = useNavigate();
  const [type, setType] = useState<string>("fixed");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  const selected = useMemo(
    () => TYPES.find((t) => t.id === type) ?? TYPES[0],
    [type],
  );

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
        body: JSON.stringify({
          title,
          type,
          description: description || undefined,
          items: [],
          pricingRules: [],
        }),
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

  return (
    <>
      <Page
        title="Create bundle"
        subtitle="Pick a type, give it a name, and watch the preview update."
        backAction={{ content: "Bundles", url: "/" }}
        primaryAction={{
          content: "Save & continue",
          onAction: onSave,
          loading: submitting,
          disabled: submitting,
        }}
      >
        <BlockStack gap="400">
          {error && (
            <Banner tone="critical" title="Could not create bundle">
              {error}
            </Banner>
          )}

          <Layout>
            <Layout.Section>
              <BlockStack gap="400">
                {/* Selected type summary card with Change button. */}
                <Card>
                  <BlockStack gap="300">
                    <InlineStack align="space-between" blockAlign="center">
                      <Text as="h2" variant="headingMd">
                        Bundle type
                      </Text>
                      <Button onClick={() => setPickerOpen(true)}>
                        Change type
                      </Button>
                    </InlineStack>
                    <div
                      style={{
                        display: "flex",
                        gap: 16,
                        alignItems: "stretch",
                      }}
                    >
                      <div
                        style={{
                          width: 96,
                          minHeight: 64,
                          borderRadius: 8,
                          background: selected.gradient,
                        }}
                      />
                      <BlockStack gap="100">
                        <Text as="h3" variant="headingSm">
                          {selected.label}
                        </Text>
                        <Text as="p" tone="subdued">
                          {selected.description}
                        </Text>
                        <Text as="p" variant="bodySm" tone="subdued">
                          <em>e.g. {selected.example}</em>
                        </Text>
                      </BlockStack>
                    </div>
                  </BlockStack>
                </Card>

                {/* Title + description. */}
                <Card>
                  <BlockStack gap="300">
                    <Text as="h2" variant="headingMd">
                      Details
                    </Text>
                    <TextField
                      label="Title"
                      value={title}
                      onChange={setTitle}
                      autoComplete="off"
                      placeholder={`${selected.label} — `}
                      requiredIndicator
                      helpText="Shown to merchants in the admin and to customers as the bundle's product title."
                    />
                    <TextField
                      label="Description (optional)"
                      value={description}
                      onChange={setDescription}
                      autoComplete="off"
                      multiline={3}
                      helpText="Short marketing copy. Appears under the title on the bundle's product page."
                    />
                  </BlockStack>
                </Card>

                <Box>
                  <Text as="p" variant="bodySm" tone="subdued">
                    Save & continue takes you to the bundle detail page,
                    where you'll add items, configure pricing rules, and
                    publish to your storefront.
                  </Text>
                </Box>
              </BlockStack>
            </Layout.Section>

            <Layout.Section variant="oneThird">
              <StorefrontPreview
                type={selected}
                title={title}
                description={description}
              />
            </Layout.Section>
          </Layout>
        </BlockStack>
      </Page>

      <Modal
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        title="Choose a bundle type"
        size="large"
      >
        <Modal.Section>
          <BlockStack gap="300">
            <Text as="p" tone="subdued">
              Each type maps to a specific buying behavior. Most stores
              start with <strong>Fixed</strong> or <strong>Mix &amp;
              match</strong>; you can change later.
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
                    onSelect={() => {
                      setType(opt.id);
                      setPickerOpen(false);
                    }}
                  />
                </Grid.Cell>
              ))}
            </Grid>
          </BlockStack>
        </Modal.Section>
      </Modal>
    </>
  );
}
