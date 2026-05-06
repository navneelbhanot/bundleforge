/**
 * Bundle Detail · Display tab (M-171).
 *
 * Per-bundle override layer for the shop-level Display defaults
 * from M-162. Each field has a "Use shop default" option that
 * sends `null` to the server — the merge logic deletes the key
 * from `displaySettings` so the storefront falls back to the shop
 * default at render time.
 *
 * helpText on each control shows what the merchant is currently
 * inheriting from the shop default if the field is unset.
 */
import { useState } from "react";
import {
  Banner,
  BlockStack,
  Button,
  Card,
  InlineStack,
  Select,
  Text,
  TextField,
} from "@shopify/polaris";

export type DisplayLayout = "grid" | "list" | "carousel";
export type DisplayColorPreset =
  | "brand"
  | "neutral"
  | "high-contrast"
  | "minimal";
export type DisplayImagePref =
  | "component_photos"
  | "bundle_hero"
  | "auto";
export type DisplaySoldOut = "hide" | "disable" | "waitlist";

export interface DisplaySettings {
  layout?: DisplayLayout;
  colorPreset?: DisplayColorPreset;
  imagePreference?: DisplayImagePref;
  addToCartCopy?: string;
  soldOutBehavior?: DisplaySoldOut;
  cssOverride?: string;
}

export interface ShopDisplayDefaults {
  layout?: DisplayLayout;
  colorPreset?: DisplayColorPreset;
  imagePreference?: DisplayImagePref;
  addToCartCopy?: string;
  soldOutBehavior?: DisplaySoldOut;
  cssOverride?: string;
}

export interface DisplayTabProps {
  bundleDisplay: DisplaySettings;
  shopDefaults: ShopDisplayDefaults;
  busy: boolean;
  /** `null` for any field means "remove the override". */
  onSave: (
    patch: { displaySettings: Record<string, string | null> },
  ) => Promise<void>;
}

const USE_SHOP = "__use_shop__";

const LAYOUT_OPTIONS = [
  { label: "Use shop default", value: USE_SHOP },
  { label: "Grid", value: "grid" },
  { label: "List", value: "list" },
  { label: "Carousel", value: "carousel" },
];

const COLOR_PRESET_OPTIONS = [
  { label: "Use shop default", value: USE_SHOP },
  { label: "Brand color", value: "brand" },
  { label: "Neutral", value: "neutral" },
  { label: "High contrast", value: "high-contrast" },
  { label: "Minimal", value: "minimal" },
];

const IMAGE_PREF_OPTIONS = [
  { label: "Use shop default", value: USE_SHOP },
  { label: "Component photos", value: "component_photos" },
  { label: "Bundle hero image", value: "bundle_hero" },
  { label: "Auto (component if any, else hero)", value: "auto" },
];

const SOLD_OUT_OPTIONS = [
  { label: "Use shop default", value: USE_SHOP },
  { label: "Hide bundle", value: "hide" },
  { label: "Show but disable Add-to-cart", value: "disable" },
  { label: "Show waitlist signup", value: "waitlist" },
];

function inheritedHint(value: string | undefined, label: string): string {
  if (value === undefined || value === null || value === "")
    return `Inheriting (no shop default set — built-in fallback applies).`;
  return `Inheriting "${value}" from shop default ${label}.`;
}

interface LayoutCardProps {
  bundle: DisplaySettings;
  shop: ShopDisplayDefaults;
  busy: boolean;
  onSave: DisplayTabProps["onSave"];
}

function LayoutCard({ bundle, shop, busy, onSave }: LayoutCardProps): JSX.Element {
  const [layout, setLayout] = useState<string>(bundle.layout ?? USE_SHOP);
  const [color, setColor] = useState<string>(bundle.colorPreset ?? USE_SHOP);
  const dirty =
    layout !== (bundle.layout ?? USE_SHOP) ||
    color !== (bundle.colorPreset ?? USE_SHOP);
  function valOrNull(v: string): string | null {
    return v === USE_SHOP ? null : v;
  }
  return (
    <Card>
      <BlockStack gap="300">
        <Text as="h2" variant="headingMd">
          Layout &amp; visual style
        </Text>
        <Text as="p" tone="subdued">
          Override the shop-level defaults for just this bundle.
          Choose <em>Use shop default</em> to inherit again.
        </Text>
        <Select
          label="Layout"
          options={LAYOUT_OPTIONS}
          value={layout}
          onChange={setLayout}
          helpText={
            layout === USE_SHOP ? inheritedHint(shop.layout, "layout") : undefined
          }
        />
        <Select
          label="Color preset"
          options={COLOR_PRESET_OPTIONS}
          value={color}
          onChange={setColor}
          helpText={
            color === USE_SHOP
              ? inheritedHint(shop.colorPreset, "color preset")
              : undefined
          }
        />
        <InlineStack align="end">
          <Button
            variant="primary"
            onClick={() =>
              onSave({
                displaySettings: {
                  layout: valOrNull(layout),
                  colorPreset: valOrNull(color),
                },
              })
            }
            loading={busy}
            disabled={busy || !dirty}
          >
            Save layout
          </Button>
        </InlineStack>
      </BlockStack>
    </Card>
  );
}

interface ImageryCardProps {
  bundle: DisplaySettings;
  shop: ShopDisplayDefaults;
  busy: boolean;
  onSave: DisplayTabProps["onSave"];
}

function ImageryCard({
  bundle,
  shop,
  busy,
  onSave,
}: ImageryCardProps): JSX.Element {
  const [imgPref, setImgPref] = useState<string>(
    bundle.imagePreference ?? USE_SHOP,
  );
  const [copy, setCopy] = useState<string>(bundle.addToCartCopy ?? "");
  const [soldOut, setSoldOut] = useState<string>(
    bundle.soldOutBehavior ?? USE_SHOP,
  );
  const copyTooLong = copy.length > 40;
  const dirty =
    imgPref !== (bundle.imagePreference ?? USE_SHOP) ||
    copy !== (bundle.addToCartCopy ?? "") ||
    soldOut !== (bundle.soldOutBehavior ?? USE_SHOP);
  function valOrNull(v: string): string | null {
    return v === USE_SHOP ? null : v;
  }
  return (
    <Card>
      <BlockStack gap="300">
        <Text as="h2" variant="headingMd">
          Imagery &amp; copy
        </Text>
        <Select
          label="Image preference"
          options={IMAGE_PREF_OPTIONS}
          value={imgPref}
          onChange={setImgPref}
          helpText={
            imgPref === USE_SHOP
              ? inheritedHint(shop.imagePreference, "image preference")
              : undefined
          }
        />
        <TextField
          label="Add-to-cart button copy"
          value={copy}
          onChange={setCopy}
          autoComplete="off"
          maxLength={40}
          showCharacterCount
          placeholder={
            shop.addToCartCopy
              ? `Inherits "${shop.addToCartCopy}"`
              : "Leave blank to use shop default"
          }
          error={copyTooLong ? "Max 40 chars" : undefined}
          helpText={
            copy.length === 0
              ? `Leave blank to inherit ${
                  shop.addToCartCopy ? `"${shop.addToCartCopy}"` : "the shop default"
                }.`
              : undefined
          }
        />
        <Select
          label="Sold-out behavior"
          options={SOLD_OUT_OPTIONS}
          value={soldOut}
          onChange={setSoldOut}
          helpText={
            soldOut === USE_SHOP
              ? inheritedHint(shop.soldOutBehavior, "sold-out behavior")
              : undefined
          }
        />
        <InlineStack align="end">
          <Button
            variant="primary"
            onClick={() =>
              onSave({
                displaySettings: {
                  imagePreference: valOrNull(imgPref),
                  // Empty string in the copy field = "inherit" too —
                  // send null so the server deletes the override.
                  addToCartCopy: copy.length > 0 ? copy : null,
                  soldOutBehavior: valOrNull(soldOut),
                },
              })
            }
            loading={busy}
            disabled={busy || !dirty || copyTooLong}
          >
            Save imagery
          </Button>
        </InlineStack>
      </BlockStack>
    </Card>
  );
}

interface CssCardProps {
  bundle: DisplaySettings;
  shop: ShopDisplayDefaults;
  busy: boolean;
  onSave: DisplayTabProps["onSave"];
}

function CssCard({ bundle, shop, busy, onSave }: CssCardProps): JSX.Element {
  const [css, setCss] = useState<string>(bundle.cssOverride ?? "");
  const dirty = css !== (bundle.cssOverride ?? "");
  const open = (css.match(/{/g) ?? []).length;
  const close = (css.match(/}/g) ?? []).length;
  const braceWarn = open !== close;
  return (
    <Card>
      <BlockStack gap="300">
        <Text as="h2" variant="headingMd">
          Custom CSS
        </Text>
        <Text as="p" tone="subdued">
          Per-bundle CSS layers ON TOP of the shop-level CSS from
          Settings → Display. Scoped under{" "}
          <code>#bundleforge-storefront [data-bundle-id=&quot;&lt;id&gt;&quot;]</code>.
          Leave blank to apply only the shop CSS.
        </Text>
        <TextField
          label="Bundle CSS override"
          value={css}
          onChange={setCss}
          multiline={10}
          autoComplete="off"
          maxLength={8000}
          showCharacterCount
          monospaced
          helpText={
            css.length === 0 && shop.cssOverride
              ? "Leave blank to inherit the shop-level CSS only."
              : undefined
          }
        />
        {braceWarn && (
          <Banner tone="warning" title="Mismatched braces">
            <p>
              Found {open} opening and {close} closing braces. CSS
              with mismatched braces won&apos;t apply.
            </p>
          </Banner>
        )}
        <InlineStack align="end">
          <Button
            variant="primary"
            onClick={() =>
              onSave({
                displaySettings: {
                  cssOverride: css.length > 0 ? css : null,
                },
              })
            }
            loading={busy}
            disabled={busy || !dirty}
          >
            Save CSS
          </Button>
        </InlineStack>
      </BlockStack>
    </Card>
  );
}

export function DisplayTab(props: DisplayTabProps): JSX.Element {
  const { bundleDisplay, shopDefaults, busy, onSave } = props;
  return (
    <BlockStack gap="400">
      <LayoutCard
        bundle={bundleDisplay}
        shop={shopDefaults}
        busy={busy}
        onSave={onSave}
      />
      <ImageryCard
        bundle={bundleDisplay}
        shop={shopDefaults}
        busy={busy}
        onSave={onSave}
      />
      <CssCard
        bundle={bundleDisplay}
        shop={shopDefaults}
        busy={busy}
        onSave={onSave}
      />
    </BlockStack>
  );
}
