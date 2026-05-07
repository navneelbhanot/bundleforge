/**
 * Visual builder — type-specific config panel (M-100).
 *
 * Read-only display of the bundle's per-type config. The Zod schema
 * for each type lives in src/services/bundles/validators.ts (M-048);
 * fields below mirror the named keys those schemas expect (or accept
 * via passthrough for the looser types).
 *
 * For passthrough types, the display surfaces the most common fields
 * merchants set. Anything not enumerated here is still preserved in
 * the underlying config blob — the panel doesn't strip it.
 */
import { Card, BlockStack, Text, TextField, Checkbox } from "@shopify/polaris";

export interface TypeConfigPanelProps {
  type: string;
  config: Record<string, unknown>;
}

function asNum(v: unknown, fallback = ""): string {
  return typeof v === "number" ? String(v) : fallback;
}
function asBool(v: unknown, fallback = false): boolean {
  return typeof v === "boolean" ? v : fallback;
}
function asString(v: unknown, fallback = ""): string {
  return typeof v === "string" ? v : fallback;
}

interface SectionProps {
  title: string;
  hint: string;
  children: React.ReactNode;
}

function Section({ title, hint, children }: SectionProps): JSX.Element {
  return (
    <Card>
      <BlockStack gap="200">
        <Text as="h2" variant="headingMd">
          {title}
        </Text>
        <Text as="p" tone="subdued">
          {hint}
        </Text>
        {children}
      </BlockStack>
    </Card>
  );
}

export function TypeConfigPanel({ type, config }: TypeConfigPanelProps): JSX.Element {
  const noop = () => {};
  switch (type) {
    case "fixed":
      return (
        <Section
          title="Fixed bundle"
          hint="Always-the-same bundle. Items + quantities are fixed; pricing rules apply on top."
        >
          <Text as="p">No additional config required.</Text>
        </Section>
      );

    case "mix_match":
      return (
        <Section
          title="Mix & match"
          hint="Customer picks any N from the items list."
        >
          <TextField
            label="Min items"
            type="number"
            value={asNum(config.minItems)}
            onChange={noop}
            autoComplete="off"
          />
          <TextField
            label="Max items"
            type="number"
            value={asNum(config.maxItems)}
            onChange={noop}
            autoComplete="off"
          />
          <Checkbox
            label="Allow duplicates"
            checked={asBool(config.allowDuplicates)}
            onChange={noop}
          />
        </Section>
      );

    case "build_box":
      return (
        <Section
          title="Build-a-box"
          hint="Multi-step picker. Each step has its own pickCount and product set."
        >
          <TextField
            label="Min items"
            type="number"
            value={asNum(config.minItems)}
            onChange={noop}
            autoComplete="off"
          />
          <TextField
            label="Max items"
            type="number"
            value={asNum(config.maxItems)}
            onChange={noop}
            autoComplete="off"
          />
          <Text as="p">
            Steps: {(config.steps as Array<unknown> | undefined)?.length ?? 0}
          </Text>
        </Section>
      );

    case "multipack":
      return (
        <Section
          title="Multipack"
          hint="Sells N units of the same product as one packaged SKU."
        >
          <TextField
            label="Pack quantity"
            type="number"
            value={asNum(config.packQuantity)}
            onChange={noop}
            autoComplete="off"
          />
        </Section>
      );

    case "wholesale":
      return (
        <Section
          title="Wholesale"
          hint="Volume-priced bulk bundles for B2B customers."
        >
          <TextField
            label="Min wholesale qty"
            type="number"
            value={asNum(config.minWholesaleQuantity)}
            onChange={noop}
            autoComplete="off"
          />
        </Section>
      );

    case "bogo":
      return (
        <Section
          title="Buy-one-get-one"
          hint="When the trigger product is in cart, the reward product is added or discounted."
        >
          <TextField
            label="Buy quantity"
            type="number"
            value={asNum(config.buyQuantity, "1")}
            onChange={noop}
            autoComplete="off"
          />
          <TextField
            label="Get quantity"
            type="number"
            value={asNum(config.getQuantity, "1")}
            onChange={noop}
            autoComplete="off"
          />
          <TextField
            label="Discount on the 'get' item (%)"
            type="number"
            value={asNum(config.getDiscountPercent, "100")}
            onChange={noop}
            autoComplete="off"
          />
        </Section>
      );

    case "bxgy":
      return (
        <Section
          title="Buy X, get Y"
          hint="Buy N of product X, get M of product Y at a discount. The trigger and reward are different products."
        >
          <TextField
            label="Buy quantity (X)"
            type="number"
            value={asNum(config.buyQuantity, "2")}
            onChange={noop}
            autoComplete="off"
          />
          <TextField
            label="Get quantity (Y)"
            type="number"
            value={asNum(config.getQuantity, "1")}
            onChange={noop}
            autoComplete="off"
          />
          <TextField
            label="Discount on Y (%)"
            type="number"
            value={asNum(config.getDiscountPercent, "50")}
            onChange={noop}
            autoComplete="off"
          />
        </Section>
      );

    case "volume":
      return (
        <Section
          title="Volume / tiered"
          hint="Per-quantity tiered pricing. Tiers come from the pricing rules; the config records the threshold strategy."
        >
          <TextField
            label="Tier count"
            type="number"
            value={asNum(
              (config.tiers as Array<unknown> | undefined)?.length,
              "0",
            )}
            onChange={noop}
            autoComplete="off"
          />
          <Checkbox
            label="Apply across all line items in the bundle"
            checked={asBool(config.aggregateAcrossLines, true)}
            onChange={noop}
          />
        </Section>
      );

    case "gift":
      return (
        <Section
          title="Free gift"
          hint="Adds a no-charge gift product when the cart subtotal crosses a threshold."
        >
          <TextField
            label="Threshold (cart total)"
            type="number"
            value={asNum(config.cartThreshold)}
            onChange={noop}
            autoComplete="off"
          />
          <TextField
            label="Gift product handle"
            value={asString(config.giftProductHandle)}
            onChange={noop}
            autoComplete="off"
          />
        </Section>
      );

    case "mystery":
      return (
        <Section
          title="Mystery box"
          hint="Random pick from the items pool. The customer commits to a quantity, not a specific product."
        >
          <TextField
            label="Items per box"
            type="number"
            value={asNum(config.itemsPerBox, "3")}
            onChange={noop}
            autoComplete="off"
          />
          <Checkbox
            label="Allow duplicates in pick"
            checked={asBool(config.allowDuplicates)}
            onChange={noop}
          />
        </Section>
      );

    case "sample":
      return (
        <Section
          title="Sample / sampler"
          hint="Trial-size selection. Common pattern: pick K samples + add full-size product."
        >
          <TextField
            label="Samples per pack"
            type="number"
            value={asNum(config.samplesPerPack, "3")}
            onChange={noop}
            autoComplete="off"
          />
          <Checkbox
            label="Require purchase of full-size product alongside"
            checked={asBool(config.requireFullSize)}
            onChange={noop}
          />
        </Section>
      );

    case "subscription":
      return (
        <Section
          title="Subscription bundle"
          hint="Recurring delivery. Interval is enforced by the storefront's selling-plan group."
        >
          <TextField
            label="Default interval (days)"
            type="number"
            value={asNum(config.intervalDays, "30")}
            onChange={noop}
            autoComplete="off"
          />
          <TextField
            label="Selling plan group ID"
            value={asString(config.sellingPlanGroupId)}
            onChange={noop}
            autoComplete="off"
            helpText="Created in Shopify Admin → Apps → MintBundle → Subscriptions."
          />
        </Section>
      );

    case "custom":
      return (
        <Section
          title="Custom"
          hint="Free-form configuration. Fields here pass through validators; consumed by your own logic."
        >
          <Text as="p" tone="subdued">
            {Object.keys(config).length === 0
              ? "No fields set."
              : `Fields: ${Object.keys(config).join(", ")}`}
          </Text>
        </Section>
      );

    default:
      return (
        <Section title={type} hint="Unknown bundle type.">
          <Text as="p">Free-form configuration.</Text>
        </Section>
      );
  }
}
