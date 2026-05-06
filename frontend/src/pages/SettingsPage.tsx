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
import { useEffect, useMemo, useState } from "react";
import {
  Banner,
  BlockStack,
  Box,
  Button,
  Card,
  InlineStack,
  Layout,
  Page,
  Select,
  Tabs,
  Text,
  TextField,
} from "@shopify/polaris";

import { PageLoading } from "../components/PageLoading";

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

interface SettingsPayload {
  safetyLock?: boolean;
  notifications?: { email?: boolean; inApp?: boolean };
  general: GeneralBlock;
  display: DisplayBlock;
}

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
  { id: "inventory", hash: "inventory", content: "Inventory", status: "deferred", milestone: "M-163" },
  { id: "pricing", hash: "pricing", content: "Pricing", status: "deferred", milestone: "M-163" },
  { id: "cart", hash: "cart", content: "Cart & checkout", status: "deferred", milestone: "M-164" },
  { id: "notifications", hash: "notifications", content: "Notifications", status: "deferred", milestone: "M-165" },
  { id: "integrations", hash: "integrations", content: "Integrations", status: "deferred", milestone: "M-166" },
  { id: "api", hash: "api", content: "API & webhooks", status: "deferred", milestone: "M-167" },
  { id: "localization", hash: "localization", content: "Localization", status: "deferred", milestone: "M-167" },
  { id: "billing", hash: "billing", content: "Billing", status: "deferred", milestone: "M-167" },
];

const SUPPORTED_LOCALES = [
  "en",
  "es",
  "fr",
  "de",
  "it",
  "pt",
  "ja",
  "zh",
  "ko",
  "nl",
  "pl",
  "sv",
  "da",
  "no",
  "ru",
] as const;

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
  return (
    <Card>
      <BlockStack gap="300">
        <Text as="h2" variant="headingMd">
          Shop
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
  const [color, setColor] = useState(initial.brandColor ?? "#1f5fa6");
  const [logoUrl, setLogoUrl] = useState(initial.logoUrl ?? "");
  const [error, setError] = useState<string | null>(null);

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

  return (
    <Card>
      <BlockStack gap="300">
        <Text as="h2" variant="headingMd">
          Brand
        </Text>
        <Text as="p" tone="subdued">
          Used as the accent color for badges and buttons rendered by
          BundleForge in the storefront and admin emails.
        </Text>
        {error && (
          <Banner tone="critical" title="Couldn't save brand">
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
          placeholder="https://cdn.example.com/logo.png"
          helpText='Direct logo upload via Shopify Files lands in M-167. For now paste a public URL.'
        />
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
          Defaults
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
          Layout &amp; visual style
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
          Imagery &amp; copy
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
          Custom CSS
        </Text>
        <Text as="p" tone="subdued">
          Scoped under <code>#bundleforge-storefront *</code>. Bad
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
          <Banner tone="warning" title="Mismatched braces">
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
    key: "general" | "display",
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

  const polarisTabs = useMemo(
    () =>
      TABS.map((t) => ({
        id: t.id,
        content: t.content,
        accessibilityLabel: t.content,
        panelID: `panel-${t.id}`,
      })),
    [],
  );

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
          <Banner tone="success" title="Settings saved" />
        )}
        {error && state && (
          <Banner tone="critical" title="Couldn't save" onDismiss={() => setError(null)}>
            {error}
          </Banner>
        )}

        <Tabs
          tabs={polarisTabs}
          selected={tabIndex}
          onSelect={selectTab}
          fitted={false}
        />

        {activeTab.id === "general" ? (
          <Layout>
            <Layout.Section>
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
            </Layout.Section>
          </Layout>
        ) : activeTab.id === "display" ? (
          <Layout>
            <Layout.Section>
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
            </Layout.Section>
          </Layout>
        ) : (
          <PlaceholderTab tab={activeTab} />
        )}
      </BlockStack>
    </Page>
  );
}
