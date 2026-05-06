/**
 * Live storefront preview of a bundle.
 *
 * Used by:
 *   - BundleCreatePage (pre-creation; placeholder items)
 *   - BundleDetailPage (post-creation; real items + computed badge
 *     derived from the bundle's pricing rules)
 *
 * Intentionally NOT a perfect render of the storefront block — it's
 * a representative mock that helps the merchant see roughly what a
 * customer will see, including the discount call-to-action. The
 * actual storefront is rendered by the Theme App Extension blocks.
 */
import {
  BlockStack,
  Box,
  Card,
  Grid,
  Text,
} from "@shopify/polaris";

import type { BundleTypeOption } from "./bundleTypes";

interface PreviewItem {
  title: string;
  quantity: number;
  sku?: string;
}

interface PricingRuleLike {
  type: string;
  value: number;
}

export interface StorefrontPreviewProps {
  type: BundleTypeOption;
  title: string;
  description?: string;
  /**
   * Real items chosen by the merchant (detail page). When omitted or
   * empty, falls back to placeholder rows from the type's preview hint.
   */
  items?: PreviewItem[];
  /**
   * Real pricing rules. When supplied we derive a discount badge
   * (e.g. "Save 20%") from the most attractive rule; otherwise we use
   * the type's default badge text.
   */
  pricingRules?: PricingRuleLike[];
}

function deriveBadge(
  type: BundleTypeOption,
  rules: PricingRuleLike[] | undefined,
): string {
  if (!rules || rules.length === 0) return type.preview.badgeText;
  // Pick the most merchant-attractive rule for the badge.
  const percentage = rules.find((r) => r.type === "percentage" && r.value > 0);
  if (percentage) return `Save ${Math.round(percentage.value)}%`;
  const flat = rules.find((r) => r.type === "flat_discount" && r.value > 0);
  if (flat) return `Save $${flat.value}`;
  const fixed = rules.find((r) => r.type === "fixed" && r.value > 0);
  if (fixed) return `Bundle for $${fixed.value}`;
  if (rules.find((r) => r.type === "bogo")) return "Buy 1, get 1 FREE";
  if (rules.find((r) => r.type === "volume")) return "More you buy, more you save";
  return type.preview.badgeText;
}

export function StorefrontPreview({
  type,
  title,
  description,
  items,
  pricingRules,
}: StorefrontPreviewProps): JSX.Element {
  const displayTitle =
    title.trim() || `Untitled ${type.label.toLowerCase()}`;
  const badge = deriveBadge(type, pricingRules);

  // If real items are provided AND non-empty, use them. Otherwise fall
  // back to placeholder rows whose count comes from the type hint.
  const usingRealItems = Array.isArray(items) && items.length > 0;
  const previewItems: PreviewItem[] = usingRealItems
    ? items!
    : Array.from({ length: type.preview.items }, (_, i) => ({
        title: `Item ${i + 1}`,
        quantity: 1,
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
          {/* Hero: gradient banner labelled with the bundle title + badge. */}
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
                <span style={{ color: "rgba(255,255,255,0.85)" }}>{badge}</span>
              </Text>
              <Text as="span" variant="headingMd">
                <span style={{ color: "white" }}>{displayTitle}</span>
              </Text>
            </BlockStack>
          </div>

          {description && description.trim() && (
            <Box paddingBlockStart="300">
              <Text as="p" tone="subdued">
                {description}
              </Text>
            </Box>
          )}

          {/* Items mock — layout depends on type, real titles when available. */}
          <Box paddingBlockStart="300">
            {type.preview.layout === "grid" ? (
              <Grid>
                {previewItems.map((it, i) => (
                  <Grid.Cell
                    key={i}
                    columnSpan={{ xs: 3, sm: 2, md: 2, lg: 2, xl: 2 }}
                  >
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
                        {it.title}
                      </Text>
                    </div>
                  </Grid.Cell>
                ))}
              </Grid>
            ) : type.preview.layout === "stepper" ? (
              <BlockStack gap="200">
                {previewItems.map((it, i) => (
                  <div
                    key={i}
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
                      {usingRealItems
                        ? it.title
                        : `Step ${i + 1}: choose your ${it.title.toLowerCase()}`}
                    </Text>
                  </div>
                ))}
              </BlockStack>
            ) : (
              <BlockStack gap="200">
                {previewItems.map((it, i) => (
                  <div
                    key={i}
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
                    <BlockStack gap="050">
                      <Text as="span" tone="subdued">
                        {it.title}
                      </Text>
                      {it.quantity > 1 && (
                        <Text as="span" variant="bodySm" tone="subdued">
                          Qty: {it.quantity}
                        </Text>
                      )}
                    </BlockStack>
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

        {!usingRealItems && (
          <Text as="p" variant="bodySm" tone="subdued">
            Items, real images, and the discount badge are placeholders.
            Add products to see the real preview.
          </Text>
        )}
      </BlockStack>
    </Card>
  );
}
