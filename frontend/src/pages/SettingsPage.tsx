/**
 * Settings page (M-161 — shell + General tab).
 *
 * Tabbed shell covering every section the Phase R1 roadmap will
 * fill. Only the General tab is fully built in this milestone; the
 * rest render a placeholder Card pointing at the milestone that
 * will land their content.
 *
 * Hash routing: /settings selects General; /settings#display selects
 * the Display tab; pushing a tab updates window.location.hash so the
 * URL is shareable / bookmarkable.
 */
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Badge,
  Banner,
  BlockStack,
  Box,
  Button,
  Card,
  Checkbox,
  ChoiceList,
  InlineStack,
  Layout,
  Modal,
  Page,
  Select,
  Tag,
  Text,
  TextField,
} from "@shopify/polaris";

import { ApiWebhooksTab } from "../components/ApiWebhooksTab";
import { BillingPanel } from "../components/BillingPanel";
import { IntegrationsTab } from "../components/IntegrationsTab";
import { PageLoading } from "../components/PageLoading";
import { SettingsSidebar } from "../components/settings/SettingsSidebar";
// SUPPORTED_LOCALES is shared with the dashboard's app-language
// selector — single source of truth in `lib/locales.ts`.
import { SUPPORTED_LOCALES } from "../lib/locales";

interface GeneralBlock {
  name: string;
  email: string;
  shopifyDomain: string;
  brandColor: string | null;
  logoUrl: string | null;
  currency: string;
  locale: string;
  timezone: string;
}

interface DisplayBlock {
  layout?: "grid" | "list" | "carousel";
  colorPreset?: "brand" | "neutral" | "high-contrast" | "minimal";
  imagePreference?: "component_photos" | "bundle_hero" | "auto";
  addToCartCopy?: string;
  soldOutBehavior?: "hide" | "disable" | "waitlist";
  cssOverride?: string;
}

interface InventoryBlock {
  lowStockThreshold?: number;
  oversellPolicy?: "prevent" | "allow_negative" | "allow_to_zero";
  auditRetentionDays?: number;
  snapshotFrequency?: "hourly" | "every_6h" | "daily" | "weekly";
  lowStockAlertEnabled?: boolean;
}

interface PricingBlock {
  roundingRule?: "nearest_cent" | "ninety_nine" | "ninety_five";
  currencyFormatterOverride?: string;
  b2bMarkupPercent?: number;
  defaultDiscountType?:
    | "percentage"
    | "flat_discount"
    | "fixed"
    | "tiered"
    | "volume"
    | "bogo"
    | "custom";
}

interface CartBlock {
  defaultMode?: "bundle_as_product" | "components_as_attributes";
  atomicCheckoutEnforcement?: "strict" | "warn" | "off";
  abandonmentBehavior?: "keep_selections" | "clear_selections" | "prompt_user";
  cartNoteTemplate?: string;
}

type NotificationChannel = "email" | "inApp" | "slack" | "teams";

interface NotificationRule {
  enabled?: boolean;
  channels?: NotificationChannel[];
}

interface LocalizationBlock {
  enabledLocales?: string[];
  fallbackLocale?: string;
  machineTranslateMissing?: boolean;
}

interface NotificationsBlock {
  email?: boolean;
  inApp?: boolean;
  recipients?: string[];
  slackWebhookUrl?: string;
  teamsWebhookUrl?: string;
  rules?: {
    lowStock?: NotificationRule;
    publishFailure?: NotificationRule;
    webhookFailure?: NotificationRule;
    aiServiceDown?: NotificationRule;
    unresolvedBundleOrder?: NotificationRule;
  };
}

interface SettingsPayload {
  safetyLock?: boolean;
  notifications: NotificationsBlock;
  general: GeneralBlock;
  display: DisplayBlock;
  inventory: InventoryBlock;
  pricing: PricingBlock;
  cart: CartBlock;
  localization: LocalizationBlock;
}

const SUPPORTED_LOCALE_LIST: string[] = [
  "en", "es", "fr", "de", "it", "pt",
  "ja", "zh", "ko", "nl", "pl", "sv",
  "da", "no", "ru",
];

const LOCALIZATION_DEFAULTS: Required<LocalizationBlock> = {
  enabledLocales: SUPPORTED_LOCALE_LIST,
  fallbackLocale: "en",
  machineTranslateMissing: false,
};

const CART_DEFAULTS: Required<CartBlock> = {
  defaultMode: "bundle_as_product",
  atomicCheckoutEnforcement: "warn",
  abandonmentBehavior: "keep_selections",
  cartNoteTemplate: "",
};

const INVENTORY_DEFAULTS: Required<InventoryBlock> = {
  lowStockThreshold: 5,
  oversellPolicy: "prevent",
  auditRetentionDays: 365,
  snapshotFrequency: "daily",
  lowStockAlertEnabled: true,
};

const PRICING_DEFAULTS: Required<PricingBlock> = {
  roundingRule: "nearest_cent",
  currencyFormatterOverride: "",
  b2bMarkupPercent: 0,
  defaultDiscountType: "percentage",
};

const DISPLAY_DEFAULTS: Required<DisplayBlock> = {
  layout: "grid",
  colorPreset: "brand",
  imagePreference: "auto",
  addToCartCopy: "Add to cart",
  soldOutBehavior: "disable",
  cssOverride: "",
};

interface TabSpec {
  id: string;
  hash: string;
  content: string;
  status: "ready" | "deferred";
  /** Milestone that ships this tab. */
  milestone?: string;
}

const TABS: TabSpec[] = [
  { id: "general", hash: "general", content: "General", status: "ready" },
  { id: "display", hash: "display", content: "Display", status: "ready" },
  { id: "inventory", hash: "inventory", content: "Inventory", status: "ready" },
  { id: "pricing", hash: "pricing", content: "Pricing", status: "ready" },
  { id: "cart", hash: "cart", content: "Cart & checkout", status: "ready" },
  { id: "notifications", hash: "notifications", content: "Notifications", status: "ready" },
  { id: "integrations", hash: "integrations", content: "Integrations", status: "ready" },
  { id: "api", hash: "api", content: "API & webhooks", status: "ready" },
  { id: "localization", hash: "localization", content: "Localization", status: "ready" },
  { id: "billing", hash: "billing", content: "Billing", status: "ready" },
];


const COMMON_CURRENCIES = [
  "USD",
  "EUR",
  "GBP",
  "CAD",
  "AUD",
  "JPY",
  "CHF",
  "CNY",
  "INR",
  "BRL",
  "MXN",
  "SEK",
  "NOK",
  "DKK",
  "PLN",
  "CZK",
  "HUF",
  "TRY",
  "ZAR",
  "SGD",
  "HKD",
  "NZD",
  "KRW",
  "AED",
  "ILS",
  "RON",
  "RUB",
  "THB",
  "PHP",
  "IDR",
] as const;

const TIMEZONES = [
  "UTC",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Anchorage",
  "America/Honolulu",
  "America/Toronto",
  "America/Mexico_City",
  "America/Sao_Paulo",
  "America/Buenos_Aires",
  "Europe/London",
  "Europe/Dublin",
  "Europe/Paris",
  "Europe/Berlin",
  "Europe/Madrid",
  "Europe/Rome",
  "Europe/Stockholm",
  "Europe/Warsaw",
  "Europe/Moscow",
  "Africa/Cairo",
  "Africa/Johannesburg",
  "Asia/Dubai",
  "Asia/Kolkata",
  "Asia/Bangkok",
  "Asia/Singapore",
  "Asia/Hong_Kong",
  "Asia/Tokyo",
  "Asia/Seoul",
  "Australia/Sydney",
] as const;

function readHashTab(): number {
  if (typeof window === "undefined") return 0;
  const hash = window.location.hash.replace(/^#/, "");
  if (!hash) return 0;
  const idx = TABS.findIndex((t) => t.hash === hash);
  return idx >= 0 ? idx : 0;
}

function writeHashTab(idx: number): void {
  if (typeof window === "undefined") return;
  const hash = TABS[idx]?.hash ?? "general";
  if (window.location.hash !== `#${hash}`) {
    window.history.replaceState(null, "", `#${hash}`);
  }
}

interface CardSaveProps {
  busy: boolean;
  onSave: () => void;
  dirty: boolean;
}

function CardSaveBar({ busy, onSave, dirty }: CardSaveProps): JSX.Element {
  return (
    <InlineStack align="end">
      <Button
        variant="primary"
        onClick={onSave}
        loading={busy}
        disabled={busy || !dirty}
      >
        Save
      </Button>
    </InlineStack>
  );
}

interface ShopCardProps {
  general: GeneralBlock;
}

function ShopCard({ general }: ShopCardProps): JSX.Element {
  const { t } = useTranslation();
  return (
    <Card>
      <BlockStack gap="300">
        <Text as="h2" variant="headingMd">
          {t("settingsPage.shop")}
        </Text>
        <Text as="p" tone="subdued">
          These come from Shopify and update automatically when the
          store's profile changes. They are read-only here.
        </Text>
        <BlockStack gap="100">
          <Text as="p">
            <strong>Name: </strong>
            {general.name}
          </Text>
          <Text as="p">
            <strong>Email: </strong>
            {general.email}
          </Text>
          <Text as="p">
            <strong>Domain: </strong>
            {general.shopifyDomain}
          </Text>
        </BlockStack>
      </BlockStack>
    </Card>
  );
}

interface BrandCardProps {
  initial: { brandColor: string | null; logoUrl: string | null };
  busy: boolean;
  onSave: (patch: { brandColor?: string; logoUrl?: string }) => Promise<void>;
}

function BrandCard({ initial, busy, onSave }: BrandCardProps): JSX.Element {
  const { t } = useTranslation();
  const [color, setColor] = useState(initial.brandColor ?? "#1f5fa6");
  const [logoUrl, setLogoUrl] = useState(initial.logoUrl ?? "");
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const colorValid = /^#[0-9a-fA-F]{6}$/.test(color);
  const logoValid =
    logoUrl.length === 0 || /^https?:\/\//.test(logoUrl);
  const dirty =
    (color !== (initial.brandColor ?? "#1f5fa6")) ||
    (logoUrl !== (initial.logoUrl ?? ""));

  async function save(): Promise<void> {
    if (!colorValid) {
      setError("Brand color must be a 6-digit hex like #1f5fa6.");
      return;
    }
    if (!logoValid) {
      setError("Logo URL must start with http:// or https://.");
      return;
    }
    setError(null);
    await onSave({
      brandColor: color,
      logoUrl: logoUrl.length > 0 ? logoUrl : undefined,
    });
  }

  async function uploadFile(file: File): Promise<void> {
    setUploading(true);
    setError(null);
    try {
      const buf = await file.arrayBuffer();
      // Build a base64 string. atob/btoa is iffy for binary;
      // walk the bytes and use String.fromCharCode + btoa.
      const bytes = new Uint8Array(buf);
      let binary = "";
      for (let i = 0; i < bytes.length; i += 1) {
        binary += String.fromCharCode(bytes[i]);
      }
      const dataBase64 = btoa(binary);
      const res = await fetch("/api/v1/settings/logo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filename: file.name,
          mimeType: file.type || "image/png",
          dataBase64,
        }),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`Upload failed: ${res.status} ${text}`);
      }
      const body = (await res.json()) as { url: string };
      setLogoUrl(body.url);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setUploading(false);
    }
  }

  return (
    <Card>
      <BlockStack gap="300">
        <Text as="h2" variant="headingMd">
          {t("settingsPage.brand")}
        </Text>
        <Text as="p" tone="subdued">
          Used as the accent color for badges and buttons rendered by
          MintBundle in the storefront and admin emails.
        </Text>
        {error && (
          <Banner tone="critical" title={t("settingsPage.brandSaveError")}>
            {error}
          </Banner>
        )}
        <InlineStack gap="400" wrap={false} blockAlign="end">
          <Box minWidth="240px">
            <TextField
              label="Brand color (hex)"
              value={color}
              onChange={setColor}
              autoComplete="off"
              error={!colorValid && color.length > 0 ? "Use #rrggbb" : undefined}
            />
          </Box>
          <span
            aria-hidden
            style={{
              width: 36,
              height: 36,
              borderRadius: 6,
              background: colorValid ? color : "transparent",
              border: "1px solid #e1e3e5",
              display: "inline-block",
            }}
          />
        </InlineStack>
        <TextField
          label="Logo URL"
          value={logoUrl}
          onChange={setLogoUrl}
          autoComplete="off"
          placeholder="https://cdn.shopify.com/.../logo.png"
          helpText='Upload a file or paste a public URL. Uploads land in your Shopify Files.'
        />
        <InlineStack gap="200" blockAlign="center">
          <Button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading || busy}
            loading={uploading}
          >
            Upload logo
          </Button>
          {uploading && (
            <Text as="span" tone="subdued" variant="bodySm">
              Uploading…
            </Text>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/gif,image/webp,image/svg+xml"
            style={{ display: "none" }}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void uploadFile(file);
              // Reset so picking the same file again triggers
              // change.
              e.target.value = "";
            }}
          />
        </InlineStack>
        {logoUrl && logoValid && (
          <Box>
            <Text as="p" tone="subdued" variant="bodySm">
              Preview:
            </Text>
            <img
              src={logoUrl}
              alt="logo preview"
              style={{ maxHeight: 56, marginTop: 4 }}
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = "none";
              }}
            />
          </Box>
        )}
        <CardSaveBar busy={busy} onSave={save} dirty={dirty} />
      </BlockStack>
    </Card>
  );
}

interface DefaultsCardProps {
  initial: { currency: string; locale: string; timezone: string };
  busy: boolean;
  onSave: (patch: {
    currency?: string;
    locale?: string;
    timezone?: string;
  }) => Promise<void>;
}

function DefaultsCard({ initial, busy, onSave }: DefaultsCardProps): JSX.Element {
  const { t } = useTranslation();
  const [currency, setCurrency] = useState(initial.currency);
  const [locale, setLocale] = useState(initial.locale);
  const [timezone, setTimezone] = useState(initial.timezone);

  const dirty =
    currency !== initial.currency ||
    locale !== initial.locale ||
    timezone !== initial.timezone;

  return (
    <Card>
      <BlockStack gap="300">
        <Text as="h2" variant="headingMd">
          {t("settingsPage.defaults")}
        </Text>
        <Text as="p" tone="subdued">
          Fallbacks for when a bundle doesn't pin its own currency,
          locale, or timezone. Saved here as overrides — the values
          Shopify gave us at install stay untouched.
        </Text>
        <Select
          label="Default currency"
          options={COMMON_CURRENCIES.map((c) => ({ label: c, value: c }))}
          value={currency}
          onChange={setCurrency}
        />
        <Select
          label="Default locale"
          options={SUPPORTED_LOCALES.map((l) => ({ label: l, value: l }))}
          value={locale}
          onChange={setLocale}
        />
        <Select
          label="Default timezone"
          options={TIMEZONES.map((t) => ({ label: t, value: t }))}
          value={timezone}
          onChange={setTimezone}
        />
        <CardSaveBar
          busy={busy}
          dirty={dirty}
          onSave={() => onSave({ currency, locale, timezone })}
        />
      </BlockStack>
    </Card>
  );
}

// ---------------- Display tab cards (M-162) ----------------

const LAYOUT_OPTIONS = [
  { label: "Grid (default)", value: "grid" },
  { label: "List", value: "list" },
  { label: "Carousel", value: "carousel" },
] as const;

const COLOR_PRESET_OPTIONS = [
  { label: "Brand color", value: "brand" },
  { label: "Neutral", value: "neutral" },
  { label: "High contrast", value: "high-contrast" },
  { label: "Minimal", value: "minimal" },
] as const;

const IMAGE_PREF_OPTIONS = [
  { label: "Component photos", value: "component_photos" },
  { label: "Bundle hero image", value: "bundle_hero" },
  { label: "Auto (component if any, else hero)", value: "auto" },
] as const;

const SOLD_OUT_OPTIONS = [
  { label: "Hide bundle", value: "hide" },
  { label: "Show but disable Add-to-cart", value: "disable" },
  { label: "Show waitlist signup", value: "waitlist" },
] as const;

interface LayoutCardProps {
  initial: Pick<DisplayBlock, "layout" | "colorPreset">;
  busy: boolean;
  onSave: (patch: Pick<DisplayBlock, "layout" | "colorPreset">) => Promise<void>;
}

function LayoutCard({ initial, busy, onSave }: LayoutCardProps): JSX.Element {
  const { t } = useTranslation();
  const [layout, setLayout] = useState<DisplayBlock["layout"]>(
    initial.layout ?? DISPLAY_DEFAULTS.layout,
  );
  const [colorPreset, setColorPreset] = useState<DisplayBlock["colorPreset"]>(
    initial.colorPreset ?? DISPLAY_DEFAULTS.colorPreset,
  );
  const dirty =
    (layout ?? DISPLAY_DEFAULTS.layout) !==
      (initial.layout ?? DISPLAY_DEFAULTS.layout) ||
    (colorPreset ?? DISPLAY_DEFAULTS.colorPreset) !==
      (initial.colorPreset ?? DISPLAY_DEFAULTS.colorPreset);
  return (
    <Card>
      <BlockStack gap="300">
        <Text as="h2" variant="headingMd">
          {t("settingsPage.layoutCard")}
        </Text>
        <Text as="p" tone="subdued">
          Default appearance for bundles rendered on the storefront.
          Individual bundles can override these defaults from their
          own Display tab (M-170).
        </Text>
        <Select
          label="Layout"
          options={LAYOUT_OPTIONS as unknown as { label: string; value: string }[]}
          value={layout ?? DISPLAY_DEFAULTS.layout}
          onChange={(v) => setLayout(v as DisplayBlock["layout"])}
        />
        <Select
          label="Color preset"
          options={
            COLOR_PRESET_OPTIONS as unknown as { label: string; value: string }[]
          }
          value={colorPreset ?? DISPLAY_DEFAULTS.colorPreset}
          onChange={(v) => setColorPreset(v as DisplayBlock["colorPreset"])}
        />
        <CardSaveBar
          busy={busy}
          dirty={dirty}
          onSave={() => onSave({ layout, colorPreset })}
        />
      </BlockStack>
    </Card>
  );
}

interface ImageryCardProps {
  initial: Pick<DisplayBlock, "imagePreference" | "addToCartCopy" | "soldOutBehavior">;
  busy: boolean;
  onSave: (
    patch: Pick<DisplayBlock, "imagePreference" | "addToCartCopy" | "soldOutBehavior">,
  ) => Promise<void>;
}

function ImageryCard({ initial, busy, onSave }: ImageryCardProps): JSX.Element {
  const { t } = useTranslation();
  const [imagePreference, setImagePreference] = useState<
    DisplayBlock["imagePreference"]
  >(initial.imagePreference ?? DISPLAY_DEFAULTS.imagePreference);
  const [copy, setCopy] = useState<string>(
    initial.addToCartCopy ?? DISPLAY_DEFAULTS.addToCartCopy,
  );
  const [soldOut, setSoldOut] = useState<DisplayBlock["soldOutBehavior"]>(
    initial.soldOutBehavior ?? DISPLAY_DEFAULTS.soldOutBehavior,
  );
  const copyTooLong = copy.length > 40;
  const copyEmpty = copy.length === 0;
  const dirty =
    (imagePreference ?? DISPLAY_DEFAULTS.imagePreference) !==
      (initial.imagePreference ?? DISPLAY_DEFAULTS.imagePreference) ||
    copy !== (initial.addToCartCopy ?? DISPLAY_DEFAULTS.addToCartCopy) ||
    (soldOut ?? DISPLAY_DEFAULTS.soldOutBehavior) !==
      (initial.soldOutBehavior ?? DISPLAY_DEFAULTS.soldOutBehavior);
  return (
    <Card>
      <BlockStack gap="300">
        <Text as="h2" variant="headingMd">
          {t("settingsPage.imageryCard")}
        </Text>
        <Select
          label="Image preference"
          options={
            IMAGE_PREF_OPTIONS as unknown as { label: string; value: string }[]
          }
          value={imagePreference ?? DISPLAY_DEFAULTS.imagePreference}
          onChange={(v) =>
            setImagePreference(v as DisplayBlock["imagePreference"])
          }
        />
        <TextField
          label="Add-to-cart button copy"
          value={copy}
          onChange={setCopy}
          autoComplete="off"
          maxLength={40}
          showCharacterCount
          error={copyEmpty ? "Required" : copyTooLong ? "Max 40 chars" : undefined}
        />
        <Select
          label="Sold-out behavior"
          options={
            SOLD_OUT_OPTIONS as unknown as { label: string; value: string }[]
          }
          value={soldOut ?? DISPLAY_DEFAULTS.soldOutBehavior}
          onChange={(v) => setSoldOut(v as DisplayBlock["soldOutBehavior"])}
        />
        <CardSaveBar
          busy={busy}
          dirty={dirty && !copyEmpty && !copyTooLong}
          onSave={() =>
            onSave({
              imagePreference,
              addToCartCopy: copy,
              soldOutBehavior: soldOut,
            })
          }
        />
      </BlockStack>
    </Card>
  );
}

interface CssCardProps {
  initial: Pick<DisplayBlock, "cssOverride">;
  busy: boolean;
  onSave: (patch: Pick<DisplayBlock, "cssOverride">) => Promise<void>;
}

function CssCard({ initial, busy, onSave }: CssCardProps): JSX.Element {
  const { t } = useTranslation();
  const [css, setCss] = useState<string>(
    initial.cssOverride ?? DISPLAY_DEFAULTS.cssOverride,
  );
  const dirty =
    css !== (initial.cssOverride ?? DISPLAY_DEFAULTS.cssOverride);
  // Soft heads-up only — the server enforces length, not validity.
  const open = (css.match(/{/g) ?? []).length;
  const close = (css.match(/}/g) ?? []).length;
  const braceWarn = open !== close;
  return (
    <Card>
      <BlockStack gap="300">
        <Text as="h2" variant="headingMd">
          {t("settingsPage.cssCard")}
        </Text>
        <Text as="p" tone="subdued">
          Scoped under <code>#mintbundle-storefront *</code>. Bad
          rules can break theme blocks — preview on a dev store
          before saving on production.
        </Text>
        <TextField
          label="CSS override"
          value={css}
          onChange={setCss}
          multiline={10}
          autoComplete="off"
          maxLength={8000}
          showCharacterCount
          monospaced
        />
        {braceWarn && (
          <Banner tone="warning" title={t("settingsPage.bracesMismatch")}>
            <p>
              Found {open} opening and {close} closing braces. CSS
              with mismatched braces won&apos;t apply.
            </p>
          </Banner>
        )}
        <CardSaveBar
          busy={busy}
          dirty={dirty}
          onSave={() => onSave({ cssOverride: css })}
        />
      </BlockStack>
    </Card>
  );
}

// ---------------- /Display tab cards ----------------

// ---------------- Inventory tab cards (M-163) ----------------

const OVERSELL_OPTIONS = [
  { label: "Prevent — block sale when any component is OOS", value: "prevent" },
  { label: "Allow to zero — sell down to 0 then block", value: "allow_to_zero" },
  { label: "Allow negative — never block (caveat: risk of refunds)", value: "allow_negative" },
] as const;

const SNAPSHOT_OPTIONS = [
  { label: "Hourly", value: "hourly" },
  { label: "Every 6 hours", value: "every_6h" },
  { label: "Daily (default)", value: "daily" },
  { label: "Weekly", value: "weekly" },
] as const;

interface StockGuardsCardProps {
  initialSafetyLock: boolean;
  initial: Pick<InventoryBlock, "lowStockThreshold" | "oversellPolicy" | "lowStockAlertEnabled">;
  busy: boolean;
  onSaveInventory: (
    patch: Pick<InventoryBlock, "lowStockThreshold" | "oversellPolicy" | "lowStockAlertEnabled">,
  ) => Promise<void>;
  onSaveSafetyLock: (next: boolean) => Promise<void>;
}

function StockGuardsCard({
  initialSafetyLock,
  initial,
  busy,
  onSaveInventory,
  onSaveSafetyLock,
}: StockGuardsCardProps): JSX.Element {
  const { t } = useTranslation();
  const [safetyLock, setSafetyLock] = useState<boolean>(initialSafetyLock);
  const [threshold, setThreshold] = useState<string>(
    String(initial.lowStockThreshold ?? INVENTORY_DEFAULTS.lowStockThreshold),
  );
  const [policy, setPolicy] = useState<InventoryBlock["oversellPolicy"]>(
    initial.oversellPolicy ?? INVENTORY_DEFAULTS.oversellPolicy,
  );
  const [alert, setAlert] = useState<boolean>(
    initial.lowStockAlertEnabled ?? INVENTORY_DEFAULTS.lowStockAlertEnabled,
  );
  const thresholdNum = Number(threshold);
  const thresholdValid =
    Number.isInteger(thresholdNum) && thresholdNum >= 0 && thresholdNum <= 100000;
  const dirtyInventory =
    String(initial.lowStockThreshold ?? INVENTORY_DEFAULTS.lowStockThreshold) !==
      threshold ||
    (initial.oversellPolicy ?? INVENTORY_DEFAULTS.oversellPolicy) !== policy ||
    (initial.lowStockAlertEnabled ?? INVENTORY_DEFAULTS.lowStockAlertEnabled) !== alert;

  return (
    <Card>
      <BlockStack gap="300">
        <Text as="h2" variant="headingMd">
          {t("settingsPage.stockGuards")}
        </Text>
        <Checkbox
          label="Safety lock — require manual approval before pushing changes to Shopify"
          checked={safetyLock}
          onChange={(checked) => {
            setSafetyLock(checked);
            void onSaveSafetyLock(checked);
          }}
          disabled={busy}
        />
        <TextField
          label="Low-stock threshold (units)"
          type="number"
          min={0}
          value={threshold}
          onChange={setThreshold}
          autoComplete="off"
          helpText="When any component drops at or below this number, MintBundle marks the bundle low-stock for the alert + storefront badge."
          error={!thresholdValid ? "0 to 100000" : undefined}
        />
        <Select
          label="Oversell policy"
          options={OVERSELL_OPTIONS as unknown as { label: string; value: string }[]}
          value={policy ?? INVENTORY_DEFAULTS.oversellPolicy}
          onChange={(v) => setPolicy(v as InventoryBlock["oversellPolicy"])}
        />
        <Checkbox
          label="Email me when a bundle goes low-stock"
          checked={alert}
          onChange={setAlert}
          helpText="Email channel + recipients are configured in M-165 (Notifications). Until then enabling this is a no-op."
        />
        <CardSaveBar
          busy={busy}
          dirty={dirtyInventory && thresholdValid}
          onSave={() =>
            onSaveInventory({
              lowStockThreshold: thresholdNum,
              oversellPolicy: policy,
              lowStockAlertEnabled: alert,
            })
          }
        />
      </BlockStack>
    </Card>
  );
}

interface AuditCardProps {
  initial: Pick<InventoryBlock, "auditRetentionDays" | "snapshotFrequency">;
  busy: boolean;
  onSave: (
    patch: Pick<InventoryBlock, "auditRetentionDays" | "snapshotFrequency">,
  ) => Promise<void>;
}

function AuditCard({ initial, busy, onSave }: AuditCardProps): JSX.Element {
  const { t } = useTranslation();
  const [days, setDays] = useState<string>(
    String(initial.auditRetentionDays ?? INVENTORY_DEFAULTS.auditRetentionDays),
  );
  const [freq, setFreq] = useState<InventoryBlock["snapshotFrequency"]>(
    initial.snapshotFrequency ?? INVENTORY_DEFAULTS.snapshotFrequency,
  );
  const daysNum = Number(days);
  const daysValid =
    Number.isInteger(daysNum) && daysNum >= 7 && daysNum <= 3650;
  const dirty =
    String(initial.auditRetentionDays ?? INVENTORY_DEFAULTS.auditRetentionDays) !==
      days ||
    (initial.snapshotFrequency ?? INVENTORY_DEFAULTS.snapshotFrequency) !== freq;
  return (
    <Card>
      <BlockStack gap="300">
        <Text as="h2" variant="headingMd">
          {t("settingsPage.auditSnapshots")}
        </Text>
        <TextField
          label="Audit log retention (days)"
          type="number"
          min={7}
          max={3650}
          value={days}
          onChange={setDays}
          autoComplete="off"
          error={!daysValid ? "Must be 7 to 3650" : undefined}
          helpText="ADR-0003 enforces immutability via a Postgres BEFORE-UPDATE trigger. Retention only governs eventual pruning by the audit-pruner cron job (separate ticket)."
        />
        <Select
          label="Snapshot frequency"
          options={SNAPSHOT_OPTIONS as unknown as { label: string; value: string }[]}
          value={freq ?? INVENTORY_DEFAULTS.snapshotFrequency}
          onChange={(v) => setFreq(v as InventoryBlock["snapshotFrequency"])}
        />
        <CardSaveBar
          busy={busy}
          dirty={dirty && daysValid}
          onSave={() =>
            onSave({ auditRetentionDays: daysNum, snapshotFrequency: freq })
          }
        />
      </BlockStack>
    </Card>
  );
}

// ---------------- /Inventory tab cards ----------------

// ---------------- Pricing tab cards (M-163) ----------------

const ROUNDING_OPTIONS = [
  { label: "Nearest cent (no rounding)", value: "nearest_cent" },
  { label: "End in .99", value: "ninety_nine" },
  { label: "End in .95", value: "ninety_five" },
] as const;

const DISCOUNT_TYPE_OPTIONS = [
  { label: "Percentage off", value: "percentage" },
  { label: "Flat amount off", value: "flat_discount" },
  { label: "Fixed bundle price", value: "fixed" },
  { label: "Tiered (per quantity)", value: "tiered" },
  { label: "Volume", value: "volume" },
  { label: "BOGO", value: "bogo" },
  { label: "Custom", value: "custom" },
] as const;

interface RoundingCardProps {
  initial: Pick<PricingBlock, "roundingRule" | "currencyFormatterOverride">;
  busy: boolean;
  onSave: (
    patch: Pick<PricingBlock, "roundingRule" | "currencyFormatterOverride">,
  ) => Promise<void>;
}

function RoundingCard({ initial, busy, onSave }: RoundingCardProps): JSX.Element {
  const { t } = useTranslation();
  const [rule, setRule] = useState<PricingBlock["roundingRule"]>(
    initial.roundingRule ?? PRICING_DEFAULTS.roundingRule,
  );
  const [fmt, setFmt] = useState<string>(
    initial.currencyFormatterOverride ??
      PRICING_DEFAULTS.currencyFormatterOverride,
  );
  const dirty =
    (initial.roundingRule ?? PRICING_DEFAULTS.roundingRule) !== rule ||
    (initial.currencyFormatterOverride ??
      PRICING_DEFAULTS.currencyFormatterOverride) !== fmt;
  return (
    <Card>
      <BlockStack gap="300">
        <Text as="h2" variant="headingMd">
          {t("settingsPage.rounding")}
        </Text>
        <Select
          label="Rounding rule"
          options={ROUNDING_OPTIONS as unknown as { label: string; value: string }[]}
          value={rule ?? PRICING_DEFAULTS.roundingRule}
          onChange={(v) => setRule(v as PricingBlock["roundingRule"])}
        />
        <TextField
          label="Currency formatter override"
          value={fmt}
          onChange={setFmt}
          autoComplete="off"
          maxLength={120}
          helpText="Use {amount} and {currency} placeholders, e.g. '{amount} {currency}' or '{currency}{amount}'. Leave blank to use Shopify's locale-aware formatter."
        />
        <CardSaveBar
          busy={busy}
          dirty={dirty}
          onSave={() =>
            onSave({ roundingRule: rule, currencyFormatterOverride: fmt })
          }
        />
      </BlockStack>
    </Card>
  );
}

interface PricingDefaultsCardProps {
  initial: Pick<PricingBlock, "defaultDiscountType" | "b2bMarkupPercent">;
  busy: boolean;
  onSave: (
    patch: Pick<PricingBlock, "defaultDiscountType" | "b2bMarkupPercent">,
  ) => Promise<void>;
}

function PricingDefaultsCard({
  initial,
  busy,
  onSave,
}: PricingDefaultsCardProps): JSX.Element {
  const { t } = useTranslation();
  const [type, setType] = useState<PricingBlock["defaultDiscountType"]>(
    initial.defaultDiscountType ?? PRICING_DEFAULTS.defaultDiscountType,
  );
  const [markup, setMarkup] = useState<string>(
    String(initial.b2bMarkupPercent ?? PRICING_DEFAULTS.b2bMarkupPercent),
  );
  const markupNum = Number(markup);
  const markupValid =
    Number.isFinite(markupNum) && markupNum >= -100 && markupNum <= 1000;
  const dirty =
    (initial.defaultDiscountType ?? PRICING_DEFAULTS.defaultDiscountType) !== type ||
    String(initial.b2bMarkupPercent ?? PRICING_DEFAULTS.b2bMarkupPercent) !== markup;
  return (
    <Card>
      <BlockStack gap="300">
        <Text as="h2" variant="headingMd">
          {t("settingsPage.newBundleDefaults")}
        </Text>
        <Select
          label="Default discount type"
          options={
            DISCOUNT_TYPE_OPTIONS as unknown as { label: string; value: string }[]
          }
          value={type ?? PRICING_DEFAULTS.defaultDiscountType}
          onChange={(v) => setType(v as PricingBlock["defaultDiscountType"])}
          helpText="Pre-fills the rule type when a merchant adds the first pricing rule on a new bundle."
        />
        <TextField
          label="B2B markup (%)"
          type="number"
          value={markup}
          onChange={setMarkup}
          autoComplete="off"
          error={!markupValid ? "Range: -100 to 1000" : undefined}
          helpText="Applied on top of the bundle subtotal for customers tagged b2b. Negatives are allowed (volume discount). Wiring at checkout lands post-R1."
        />
        <CardSaveBar
          busy={busy}
          dirty={dirty && markupValid}
          onSave={() =>
            onSave({ defaultDiscountType: type, b2bMarkupPercent: markupNum })
          }
        />
      </BlockStack>
    </Card>
  );
}

// ---------------- /Pricing tab cards ----------------

// ---------------- Cart & Checkout tab cards (M-164) ----------------

const CART_MODE_OPTIONS = [
  {
    label: "Sell as a single product line that expands at cart time (recommended)",
    value: "bundle_as_product",
  },
  {
    label: "Add component lines directly with bundle attributes",
    value: "components_as_attributes",
  },
] as const;

const ENFORCEMENT_OPTIONS = [
  { label: "Strict — block checkout if a component goes OOS", value: "strict" },
  { label: "Warn — let checkout proceed, surface a warning", value: "warn" },
  { label: "Off — no validation at checkout", value: "off" },
] as const;

const ABANDONMENT_OPTIONS = [
  { label: "Keep selections", value: "keep_selections" },
  { label: "Clear selections", value: "clear_selections" },
  { label: "Ask the customer", value: "prompt_user" },
] as const;

interface CartModeCardProps {
  initial: Pick<CartBlock, "defaultMode">;
  busy: boolean;
  onSave: (patch: Pick<CartBlock, "defaultMode">) => Promise<void>;
}

function CartModeCard({ initial, busy, onSave }: CartModeCardProps): JSX.Element {
  const { t } = useTranslation();
  const [mode, setMode] = useState<CartBlock["defaultMode"]>(
    initial.defaultMode ?? CART_DEFAULTS.defaultMode,
  );
  const dirty = (initial.defaultMode ?? CART_DEFAULTS.defaultMode) !== mode;
  return (
    <Card>
      <BlockStack gap="300">
        <Text as="h2" variant="headingMd">
          {t("settingsPage.cartMode")}
        </Text>
        <Text as="p" tone="subdued">
          Picks which Cart Transform path runs at checkout.
          <strong> Bundle-as-product</strong> means a single product
          line that MintBundle expands into components at cart time
          — best for inventory tracking and 3PL routing.
          <strong> Components-as-attributes</strong> places components
          directly on the cart with line attributes — best when your
          theme block already manages selections.
        </Text>
        <Select
          label="Default mode for new bundles"
          options={CART_MODE_OPTIONS as unknown as { label: string; value: string }[]}
          value={mode ?? CART_DEFAULTS.defaultMode}
          onChange={(v) => setMode(v as CartBlock["defaultMode"])}
        />
        <CardSaveBar
          busy={busy}
          dirty={dirty}
          onSave={() => onSave({ defaultMode: mode })}
        />
      </BlockStack>
    </Card>
  );
}

interface CheckoutProtectionsCardProps {
  initial: Pick<
    CartBlock,
    "atomicCheckoutEnforcement" | "abandonmentBehavior" | "cartNoteTemplate"
  >;
  busy: boolean;
  onSave: (
    patch: Pick<
      CartBlock,
      "atomicCheckoutEnforcement" | "abandonmentBehavior" | "cartNoteTemplate"
    >,
  ) => Promise<void>;
}

function CheckoutProtectionsCard({
  initial,
  busy,
  onSave,
}: CheckoutProtectionsCardProps): JSX.Element {
  const { t } = useTranslation();
  const [enforcement, setEnforcement] = useState<
    CartBlock["atomicCheckoutEnforcement"]
  >(initial.atomicCheckoutEnforcement ?? CART_DEFAULTS.atomicCheckoutEnforcement);
  const [abandon, setAbandon] = useState<CartBlock["abandonmentBehavior"]>(
    initial.abandonmentBehavior ?? CART_DEFAULTS.abandonmentBehavior,
  );
  const [note, setNote] = useState<string>(
    initial.cartNoteTemplate ?? CART_DEFAULTS.cartNoteTemplate,
  );
  const noteTooLong = note.length > 280;
  const dirty =
    (initial.atomicCheckoutEnforcement ?? CART_DEFAULTS.atomicCheckoutEnforcement) !==
      enforcement ||
    (initial.abandonmentBehavior ?? CART_DEFAULTS.abandonmentBehavior) !==
      abandon ||
    (initial.cartNoteTemplate ?? CART_DEFAULTS.cartNoteTemplate) !== note;
  return (
    <Card>
      <BlockStack gap="300">
        <Text as="h2" variant="headingMd">
          {t("settingsPage.checkoutProtections")}
        </Text>
        <Select
          label="Atomic checkout enforcement"
          options={ENFORCEMENT_OPTIONS as unknown as { label: string; value: string }[]}
          value={enforcement ?? CART_DEFAULTS.atomicCheckoutEnforcement}
          onChange={(v) =>
            setEnforcement(v as CartBlock["atomicCheckoutEnforcement"])
          }
          helpText="What to do if a component goes out of stock between cart-add and payment authorization. Wired by the checkout-validation extension in a follow-on ticket; the setting persists today."
        />
        <Select
          label="Cart abandonment behavior"
          options={ABANDONMENT_OPTIONS as unknown as { label: string; value: string }[]}
          value={abandon ?? CART_DEFAULTS.abandonmentBehavior}
          onChange={(v) => setAbandon(v as CartBlock["abandonmentBehavior"])}
          helpText="What to do with in-progress bundle selections when the customer leaves and comes back. Storefront block reads this in a follow-on ticket."
        />
        <TextField
          label="Cart line note template"
          value={note}
          onChange={setNote}
          autoComplete="off"
          multiline={3}
          maxLength={280}
          showCharacterCount
          error={noteTooLong ? "Max 280 chars" : undefined}
          helpText="Optional. Inserted as a Shopify cart-line note on every bundle line. Supports {bundle_title} and {components_count} placeholders. Useful for 3PL/accounting visibility."
        />
        <CardSaveBar
          busy={busy}
          dirty={dirty && !noteTooLong}
          onSave={() =>
            onSave({
              atomicCheckoutEnforcement: enforcement,
              abandonmentBehavior: abandon,
              cartNoteTemplate: note,
            })
          }
        />
      </BlockStack>
    </Card>
  );
}

// ---------------- /Cart & Checkout tab cards ----------------

// ---------------- Notifications tab cards (M-165) ----------------

const ALERT_RULES: Array<{
  key: keyof NonNullable<NotificationsBlock["rules"]>;
  label: string;
  hint: string;
}> = [
  {
    key: "lowStock",
    label: "Low stock",
    hint: "When a bundle component drops at/below the threshold from the Inventory tab.",
  },
  {
    key: "publishFailure",
    label: "Publish failure",
    hint: "When publishing a bundle to Shopify fails (productCreate userErrors, network, etc.).",
  },
  {
    key: "webhookFailure",
    label: "Webhook delivery failure",
    hint: "When a Shopify webhook handler raises (HMAC mismatch ignored — that's silent).",
  },
  {
    key: "aiServiceDown",
    label: "AI service down",
    hint: "When the recommender service stops responding to health checks.",
  },
  {
    key: "unresolvedBundleOrder",
    label: "Unresolved bundle order",
    hint: "When orders/create webhook arrives for an order whose lines don't resolve to a known bundle.",
  },
];

const ALL_CHANNELS: { label: string; value: NotificationChannel }[] = [
  { label: "Email", value: "email" },
  { label: "In-app", value: "inApp" },
  { label: "Slack", value: "slack" },
  { label: "Teams", value: "teams" },
];

interface ChannelsCardProps {
  initial: Pick<
    NotificationsBlock,
    "recipients" | "slackWebhookUrl" | "teamsWebhookUrl" | "inApp"
  >;
  busy: boolean;
  onSave: (
    patch: Pick<
      NotificationsBlock,
      "recipients" | "slackWebhookUrl" | "teamsWebhookUrl" | "inApp"
    >,
  ) => Promise<void>;
}

function ChannelsCard({ initial, busy, onSave }: ChannelsCardProps): JSX.Element {
  const { t } = useTranslation();
  const [recipients, setRecipients] = useState<string[]>(initial.recipients ?? []);
  const [pending, setPending] = useState<string>("");
  const [slack, setSlack] = useState<string>(initial.slackWebhookUrl ?? "");
  const [teams, setTeams] = useState<string>(initial.teamsWebhookUrl ?? "");
  const [inApp, setInApp] = useState<boolean>(initial.inApp !== false);
  const [error, setError] = useState<string | null>(null);

  function addPending(): void {
    const trimmed = pending.trim();
    if (trimmed.length === 0) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setError("Please enter a valid email address.");
      return;
    }
    if (recipients.includes(trimmed)) {
      setPending("");
      return;
    }
    if (recipients.length >= 20) {
      setError("Max 20 recipients.");
      return;
    }
    setRecipients([...recipients, trimmed]);
    setPending("");
    setError(null);
  }

  function removeRecipient(addr: string): void {
    setRecipients(recipients.filter((r) => r !== addr));
  }

  const slackValid =
    slack.length === 0 || /^https?:\/\//.test(slack);
  const teamsValid =
    teams.length === 0 || /^https?:\/\//.test(teams);

  const dirty =
    JSON.stringify(initial.recipients ?? []) !== JSON.stringify(recipients) ||
    (initial.slackWebhookUrl ?? "") !== slack ||
    (initial.teamsWebhookUrl ?? "") !== teams ||
    (initial.inApp !== false) !== inApp;

  async function save(): Promise<void> {
    if (!slackValid) {
      setError("Slack webhook URL must start with http:// or https://.");
      return;
    }
    if (!teamsValid) {
      setError("Teams webhook URL must start with http:// or https://.");
      return;
    }
    setError(null);
    await onSave({
      recipients,
      slackWebhookUrl: slack,
      teamsWebhookUrl: teams,
      inApp,
    });
  }

  return (
    <Card>
      <BlockStack gap="300">
        <Text as="h2" variant="headingMd">
          {t("settingsPage.channels")}
        </Text>
        <Text as="p" tone="subdued">
          Where alerts are sent. The Email channel uses these
          recipients; the in-app channel surfaces inside the
          MintBundle admin.
        </Text>
        {error && (
          <Banner tone="critical" title={t("settingsPage.channelsSaveError")}>
            {error}
          </Banner>
        )}

        <Box>
          <Text as="p" variant="bodyMd" fontWeight="semibold">
            Email recipients
          </Text>
          <InlineStack gap="200" align="start" blockAlign="center" wrap>
            {recipients.map((r) => (
              <Tag key={r} onRemove={() => removeRecipient(r)}>
                {r}
              </Tag>
            ))}
          </InlineStack>
          <Box paddingBlockStart="200">
            <InlineStack gap="200" wrap={false} blockAlign="end">
              <Box minWidth="280px">
                <TextField
                  label="Add recipient"
                  value={pending}
                  onChange={setPending}
                  type="email"
                  autoComplete="off"
                  placeholder="ops@example.com"
                />
              </Box>
              <Button onClick={addPending}>Add</Button>
            </InlineStack>
          </Box>
        </Box>

        <TextField
          label="Slack webhook URL"
          value={slack}
          onChange={setSlack}
          autoComplete="off"
          placeholder="https://hooks.slack.com/services/..."
          error={!slackValid ? "Must start with http(s)://" : undefined}
        />
        <TextField
          label="Teams webhook URL"
          value={teams}
          onChange={setTeams}
          autoComplete="off"
          placeholder="https://outlook.office.com/webhook/..."
          error={!teamsValid ? "Must start with http(s)://" : undefined}
        />

        <Checkbox
          label="In-app notifications (banner inside the admin)"
          checked={inApp}
          onChange={setInApp}
        />

        <CardSaveBar busy={busy} dirty={dirty} onSave={save} />
      </BlockStack>
    </Card>
  );
}

interface EmailEnableCardProps {
  initial: Pick<NotificationsBlock, "email">;
  recipientsCount: number;
  busy: boolean;
  onSave: (patch: Pick<NotificationsBlock, "email">) => Promise<void>;
}

function EmailEnableCard({
  initial,
  recipientsCount,
  busy,
  onSave,
}: EmailEnableCardProps): JSX.Element {
  const { t } = useTranslation();
  const [enabled, setEnabled] = useState<boolean>(initial.email !== false);
  const dirty = (initial.email !== false) !== enabled;
  return (
    <Card>
      <BlockStack gap="300">
        <Text as="h2" variant="headingMd">
          {t("settingsPage.emailChannel")}
        </Text>
        <Checkbox
          label="Send alerts via email"
          checked={enabled}
          onChange={setEnabled}
        />
        <Text as="p" tone="subdued">
          {recipientsCount === 0
            ? "No recipients configured yet — alerts won't be delivered until you add at least one address in the Channels card above."
            : `Will go to ${recipientsCount} recipient${recipientsCount === 1 ? "" : "s"} configured in the Channels card.`}
        </Text>
        <CardSaveBar
          busy={busy}
          dirty={dirty}
          onSave={() => onSave({ email: enabled })}
        />
      </BlockStack>
    </Card>
  );
}

interface AlertRulesCardProps {
  initial: NonNullable<NotificationsBlock["rules"]>;
  busy: boolean;
  onSave: (patch: { rules: NotificationsBlock["rules"] }) => Promise<void>;
}

function AlertRulesCard({
  initial,
  busy,
  onSave,
}: AlertRulesCardProps): JSX.Element {
  const { t } = useTranslation();
  // Local mutable state mirrors the persisted shape; one ChoiceList per rule.
  const [rules, setRules] = useState<NonNullable<NotificationsBlock["rules"]>>(initial);

  function updateRule(
    key: keyof NonNullable<NotificationsBlock["rules"]>,
    next: NotificationRule,
  ): void {
    setRules({ ...rules, [key]: { ...(rules[key] ?? {}), ...next } });
  }

  const dirty = JSON.stringify(rules) !== JSON.stringify(initial);

  return (
    <Card>
      <BlockStack gap="300">
        <Text as="h2" variant="headingMd">
          {t("settingsPage.alertRules")}
        </Text>
        <Text as="p" tone="subdued">
          Pick which events trigger an alert and which channels each
          one uses. Channels still need to be configured above.
          Behaviour wiring for events without an emitter today is
          tracked in M-165b.
        </Text>
        <BlockStack gap="400">
          {ALERT_RULES.map((rule) => {
            const current = rules[rule.key] ?? { enabled: false, channels: [] };
            return (
              <Box
                key={rule.key}
                padding="300"
                borderColor="border"
                borderWidth="025"
                borderRadius="200"
              >
                <BlockStack gap="200">
                  <InlineStack align="space-between" blockAlign="center" wrap>
                    <Text as="h3" variant="headingSm">
                      {rule.label}
                    </Text>
                    <Checkbox
                      label="Enabled"
                      labelHidden
                      checked={current.enabled === true}
                      onChange={(checked) =>
                        updateRule(rule.key, { enabled: checked })
                      }
                    />
                  </InlineStack>
                  <Text as="p" tone="subdued" variant="bodySm">
                    {rule.hint}
                  </Text>
                  <ChoiceList
                    title="Channels"
                    titleHidden
                    allowMultiple
                    choices={ALL_CHANNELS}
                    selected={(current.channels ?? []) as string[]}
                    onChange={(selected) =>
                      updateRule(rule.key, {
                        channels: selected as NotificationChannel[],
                      })
                    }
                  />
                </BlockStack>
              </Box>
            );
          })}
        </BlockStack>
        <CardSaveBar
          busy={busy}
          dirty={dirty}
          onSave={() => onSave({ rules })}
        />
      </BlockStack>
    </Card>
  );
}

// ---------------- /Notifications tab cards ----------------

// ---------------- Localization tab card (M-167) ----------------

interface LocalizationCardProps {
  initial: LocalizationBlock;
  busy: boolean;
  onSave: (patch: LocalizationBlock) => Promise<void>;
}

function LocalizationCard({ initial, busy, onSave }: LocalizationCardProps): JSX.Element {
  const { t } = useTranslation();
  const initEnabled = initial.enabledLocales ?? LOCALIZATION_DEFAULTS.enabledLocales;
  const initFallback = initial.fallbackLocale ?? LOCALIZATION_DEFAULTS.fallbackLocale;
  const initMt =
    initial.machineTranslateMissing ?? LOCALIZATION_DEFAULTS.machineTranslateMissing;

  const [enabled, setEnabled] = useState<string[]>(initEnabled);
  const [fallback, setFallback] = useState<string>(initFallback);
  const [mt, setMt] = useState<boolean>(initMt);

  const dirty =
    JSON.stringify(initEnabled) !== JSON.stringify(enabled) ||
    initFallback !== fallback ||
    initMt !== mt;

  // The fallback must be one of the enabled locales — silently
  // promote it if the merchant disabled the current fallback.
  const fallbackInEnabled = enabled.includes(fallback);

  return (
    <Card>
      <BlockStack gap="300">
        <Text as="h2" variant="headingMd">
          {t("settingsPage.localization")}
        </Text>
        <Text as="p" tone="subdued">
          Choose which of the 15 supported locales the storefront and
          admin emails are allowed to use. Disabled locales fall back
          to your fallback locale below.
        </Text>
        <ChoiceList
          title="Enabled locales"
          allowMultiple
          choices={SUPPORTED_LOCALE_LIST.map((l) => ({
            label: l,
            value: l,
          }))}
          selected={enabled}
          onChange={(next) => setEnabled(next)}
        />
        <Select
          label="Fallback locale"
          options={SUPPORTED_LOCALE_LIST.map((l) => ({ label: l, value: l }))}
          value={fallback}
          onChange={setFallback}
          helpText={
            !fallbackInEnabled
              ? "Heads-up: this fallback isn't in the enabled list. The storefront will still use it for missing translations, but you should normally include it."
              : undefined
          }
        />
        <Checkbox
          label="Machine-translate missing strings"
          checked={mt}
          onChange={setMt}
          helpText="When a string isn't translated, route the source string through the i18n.t() lookup chain. Server-side wiring to a translation service lands in a follow-on ticket; until then this is a passthrough."
        />
        <CardSaveBar
          busy={busy}
          dirty={dirty}
          onSave={() =>
            onSave({
              enabledLocales: enabled,
              fallbackLocale: fallback,
              machineTranslateMissing: mt,
            })
          }
        />
      </BlockStack>
    </Card>
  );
}

// ---------------- /Localization tab card ----------------

interface PlaceholderTabProps {
  tab: TabSpec;
}

function PlaceholderTab({ tab }: PlaceholderTabProps): JSX.Element {
  return (
    <Card>
      <BlockStack gap="200">
        <Text as="h2" variant="headingMd">
          {tab.content}
        </Text>
        <Text as="p" tone="subdued">
          This section is being built in {tab.milestone ?? "a future milestone"}.
          See <code>docs/plans/rich-admin-ui-roadmap.md</code> for the
          full plan. Existing settings persist server-side and continue
          to work — only their UI surface is moving.
        </Text>
      </BlockStack>
    </Card>
  );
}

export function SettingsPage(): JSX.Element {
  const { t } = useTranslation();
  const [state, setState] = useState<SettingsPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);
  const [tabIndex, setTabIndex] = useState<number>(readHashTab());

  useEffect(() => {
    fetch("/api/v1/settings")
      .then((r) =>
        r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`)),
      )
      .then((body: SettingsPayload) => setState(body))
      .catch((e: Error) => setError(e.message));
  }, []);

  useEffect(() => {
    function onHash(): void {
      setTabIndex(readHashTab());
    }
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  function selectTab(idx: number): void {
    setTabIndex(idx);
    writeHashTab(idx);
  }

  async function patchSubobject(
    key:
      | "general"
      | "display"
      | "inventory"
      | "pricing"
      | "cart"
      | "notifications"
      | "localization",
    patch: Record<string, unknown>,
  ): Promise<void> {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [key]: patch }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const merged = (await res.json()) as SettingsPayload;
      setState(merged);
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 2400);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  const patchGeneral = (patch: Record<string, unknown>) =>
    patchSubobject("general", patch);
  const patchDisplay = (patch: Record<string, unknown>) =>
    patchSubobject("display", patch);
  const patchInventory = (patch: Record<string, unknown>) =>
    patchSubobject("inventory", patch);
  const patchPricing = (patch: Record<string, unknown>) =>
    patchSubobject("pricing", patch);
  const patchCart = (patch: Record<string, unknown>) =>
    patchSubobject("cart", patch);
  const patchNotifications = (patch: Record<string, unknown>) =>
    patchSubobject("notifications", patch);
  const patchLocalization = (patch: Record<string, unknown>) =>
    patchSubobject("localization", patch);

  async function patchSafetyLock(next: boolean): Promise<void> {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ safetyLock: next }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const merged = (await res.json()) as SettingsPayload;
      setState(merged);
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 2400);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  if (error && !state) {
    return (
      <Page title="Settings">
        <Card>
          <Text as="p" tone="critical">
            {error}
          </Text>
        </Card>
      </Page>
    );
  }
  if (!state) {
    return <PageLoading title="Settings" variant="list" primaryAction={false} />;
  }

  const activeTab = TABS[tabIndex];

  return (
    <Page title="Settings">
      <BlockStack gap="400">
        {savedFlash && (
          <Banner tone="success" title={t("settingsPage.saved")} />
        )}
        {error && state && (
          <Banner tone="critical" title={t("settingsPage.saveError")} onDismiss={() => setError(null)}>
            {error}
          </Banner>
        )}

        <Layout>
          <Layout.Section variant="oneThird">
            <SettingsSidebar
              tabs={TABS}
              activeIndex={tabIndex}
              onSelect={selectTab}
            />
          </Layout.Section>
          <Layout.Section>
            {activeTab.id === "general" ? (
          <BlockStack gap="400">
                <ShopCard general={state.general} />
                <BrandCard
                  initial={{
                    brandColor: state.general.brandColor,
                    logoUrl: state.general.logoUrl,
                  }}
                  busy={saving}
                  onSave={patchGeneral}
                />
                <DefaultsCard
                  initial={{
                    currency: state.general.currency,
                    locale: state.general.locale,
                    timezone: state.general.timezone,
                  }}
                  busy={saving}
                  onSave={patchGeneral}
                />
          </BlockStack>
        ) : activeTab.id === "inventory" ? (
          <BlockStack gap="400">
                <StockGuardsCard
                  initialSafetyLock={state.safetyLock === true}
                  initial={{
                    lowStockThreshold: state.inventory.lowStockThreshold,
                    oversellPolicy: state.inventory.oversellPolicy,
                    lowStockAlertEnabled: state.inventory.lowStockAlertEnabled,
                  }}
                  busy={saving}
                  onSaveInventory={patchInventory}
                  onSaveSafetyLock={patchSafetyLock}
                />
                <AuditCard
                  initial={{
                    auditRetentionDays: state.inventory.auditRetentionDays,
                    snapshotFrequency: state.inventory.snapshotFrequency,
                  }}
                  busy={saving}
                  onSave={patchInventory}
                />
          </BlockStack>
        ) : activeTab.id === "pricing" ? (
          <BlockStack gap="400">
                <RoundingCard
                  initial={{
                    roundingRule: state.pricing.roundingRule,
                    currencyFormatterOverride: state.pricing.currencyFormatterOverride,
                  }}
                  busy={saving}
                  onSave={patchPricing}
                />
                <PricingDefaultsCard
                  initial={{
                    defaultDiscountType: state.pricing.defaultDiscountType,
                    b2bMarkupPercent: state.pricing.b2bMarkupPercent,
                  }}
                  busy={saving}
                  onSave={patchPricing}
                />
          </BlockStack>
        ) : activeTab.id === "integrations" ? (
          <IntegrationsTab shopifyDomain={state.general.shopifyDomain} />
        ) : activeTab.id === "localization" ? (
          <LocalizationCard
            initial={state.localization}
            busy={saving}
            onSave={(patch) =>
              patchLocalization(patch as Record<string, unknown>)
            }
          />
        ) : activeTab.id === "billing" ? (
          <BillingPanel />
        ) : activeTab.id === "api" ? (
          <ApiWebhooksTab />
        ) : activeTab.id === "notifications" ? (
          <BlockStack gap="400">
                <ChannelsCard
                  initial={{
                    recipients: state.notifications.recipients,
                    slackWebhookUrl: state.notifications.slackWebhookUrl,
                    teamsWebhookUrl: state.notifications.teamsWebhookUrl,
                    inApp: state.notifications.inApp,
                  }}
                  busy={saving}
                  onSave={patchNotifications}
                />
                <EmailEnableCard
                  initial={{ email: state.notifications.email }}
                  recipientsCount={
                    state.notifications.recipients?.length ?? 0
                  }
                  busy={saving}
                  onSave={patchNotifications}
                />
                <AlertRulesCard
                  initial={state.notifications.rules ?? {}}
                  busy={saving}
                  onSave={patchNotifications}
                />
          </BlockStack>
        ) : activeTab.id === "cart" ? (
          <BlockStack gap="400">
                <CartModeCard
                  initial={{ defaultMode: state.cart.defaultMode }}
                  busy={saving}
                  onSave={patchCart}
                />
                <CheckoutProtectionsCard
                  initial={{
                    atomicCheckoutEnforcement: state.cart.atomicCheckoutEnforcement,
                    abandonmentBehavior: state.cart.abandonmentBehavior,
                    cartNoteTemplate: state.cart.cartNoteTemplate,
                  }}
                  busy={saving}
                  onSave={patchCart}
                />
          </BlockStack>
        ) : activeTab.id === "display" ? (
          <BlockStack gap="400">
                <LayoutCard
                  initial={{
                    layout: state.display.layout,
                    colorPreset: state.display.colorPreset,
                  }}
                  busy={saving}
                  onSave={patchDisplay}
                />
                <ImageryCard
                  initial={{
                    imagePreference: state.display.imagePreference,
                    addToCartCopy: state.display.addToCartCopy,
                    soldOutBehavior: state.display.soldOutBehavior,
                  }}
                  busy={saving}
                  onSave={patchDisplay}
                />
                <CssCard
                  initial={{ cssOverride: state.display.cssOverride }}
                  busy={saving}
                  onSave={patchDisplay}
                />
          </BlockStack>
            ) : (
              <PlaceholderTab tab={activeTab} />
            )}
          </Layout.Section>
        </Layout>
      </BlockStack>
    </Page>
  );
}
