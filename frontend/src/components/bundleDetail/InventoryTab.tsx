/**
 * Bundle Detail · Inventory tab (M-173).
 *
 * Per-bundle override layer for the shop-level Inventory defaults
 * from M-163, plus two bundle-specific rules:
 *   - pauseWhenComponentBelow: pause the bundle when any
 *     component drops under N (0 = no guard).
 *   - componentOnlyMode: render the bundle's components
 *     individually on the storefront instead of one bundle line.
 *
 * Three cards, each with its own per-card Save. Empty number
 * fields and "Use shop default" Select options send `null` so
 * the server's deep-merge deletes the key — the storefront then
 * falls back to the shop-level default at render time.
 */
import { useState } from "react";
import {
  Banner,
  BlockStack,
  Button,
  Card,
  Checkbox,
  InlineStack,
  Select,
  Text,
  TextField,
} from "@shopify/polaris";

export type OversellPolicy = "prevent" | "allow_negative" | "allow_to_zero";

export interface InventoryRules {
  lowStockThreshold?: number | null;
  oversellPolicy?: OversellPolicy | null;
  lowStockAlertEnabled?: boolean | null;
  pauseWhenComponentBelow?: number | null;
  componentOnlyMode?: boolean | null;
}

export interface ShopInventoryDefaults {
  lowStockThreshold?: number;
  oversellPolicy?: OversellPolicy;
  lowStockAlertEnabled?: boolean;
}

export interface InventoryTabProps {
  inventoryRules: InventoryRules;
  shopDefaults: ShopInventoryDefaults;
  busy: boolean;
  /** `null` for any field means "remove the override". */
  onSave: (
    patch: { inventoryRules: Record<string, unknown> },
  ) => Promise<void>;
}

const USE_SHOP = "__use_shop__";

const OVERSELL_OPTIONS = [
  { label: "Use shop default", value: USE_SHOP },
  { label: "Prevent oversell (block when out of stock)", value: "prevent" },
  { label: "Allow to zero (sell down to 0, then stop)", value: "allow_to_zero" },
  { label: "Allow negative (always allow purchase)", value: "allow_negative" },
];

function describeShopOversell(p: OversellPolicy | undefined): string {
  switch (p) {
    case "prevent":
      return "Prevent oversell";
    case "allow_to_zero":
      return "Allow to zero";
    case "allow_negative":
      return "Allow negative";
    default:
      return "Prevent oversell";
  }
}

function parseInt0(v: string): number | null {
  if (v.trim().length === 0) return null;
  const n = Number.parseInt(v, 10);
  if (!Number.isFinite(n) || n < 0) return null;
  return n;
}

// ---------------- Low-stock thresholds ----------------

interface ThresholdsCardProps {
  initialLowStock: number | null;
  initialPauseBelow: number | null;
  initialAlert: boolean | null;
  shopDefaults: ShopInventoryDefaults;
  busy: boolean;
  onSave: InventoryTabProps["onSave"];
}

function ThresholdsCard({
  initialLowStock,
  initialPauseBelow,
  initialAlert,
  shopDefaults,
  busy,
  onSave,
}: ThresholdsCardProps): JSX.Element {
  const [lowStock, setLowStock] = useState<string>(
    initialLowStock !== null ? String(initialLowStock) : "",
  );
  const [pauseBelow, setPauseBelow] = useState<string>(
    initialPauseBelow !== null ? String(initialPauseBelow) : "",
  );
  const [alertEnabled, setAlertEnabled] = useState<boolean | null>(initialAlert);

  const lowStockNum = parseInt0(lowStock);
  const pauseBelowNum = parseInt0(pauseBelow);

  const dirty =
    lowStockNum !== initialLowStock ||
    pauseBelowNum !== initialPauseBelow ||
    alertEnabled !== initialAlert;

  return (
    <Card>
      <BlockStack gap="300">
        <Text as="h2" variant="headingMd">
          Low-stock thresholds
        </Text>
        <Text as="p" tone="subdued">
          Override the shop-wide stock guards just for this bundle.
          Leave a field blank to inherit the shop default.
        </Text>

        <TextField
          label="Low-stock threshold (units)"
          type="number"
          min={0}
          max={100000}
          value={lowStock}
          onChange={setLowStock}
          autoComplete="off"
          placeholder=""
          helpText={
            lowStockNum === null
              ? `Using shop default: ${
                  shopDefaults.lowStockThreshold ?? 10
                } units.`
              : "When stock drops below this, the bundle is flagged low-stock."
          }
        />

        <TextField
          label="Pause when any component drops below (units)"
          type="number"
          min={0}
          max={100000}
          value={pauseBelow}
          onChange={setPauseBelow}
          autoComplete="off"
          placeholder=""
          helpText="When any component's available stock drops under this number, the storefront stops accepting new bundle adds. Set to 0 (or leave blank) to disable."
        />

        <Checkbox
          label="Send a low-stock alert when this bundle hits the threshold"
          checked={alertEnabled === true}
          onChange={(checked) => setAlertEnabled(checked ? true : false)}
          helpText={
            initialAlert === null
              ? `Inheriting shop default: ${
                  shopDefaults.lowStockAlertEnabled ? "on" : "off"
                }.`
              : undefined
          }
        />

        <InlineStack align="end">
          <Button
            variant="primary"
            onClick={() =>
              onSave({
                inventoryRules: {
                  lowStockThreshold: lowStockNum,
                  pauseWhenComponentBelow: pauseBelowNum,
                  lowStockAlertEnabled: alertEnabled,
                },
              })
            }
            loading={busy}
            disabled={busy || !dirty}
          >
            Save thresholds
          </Button>
        </InlineStack>
      </BlockStack>
    </Card>
  );
}

// ---------------- Oversell policy ----------------

interface OversellCardProps {
  initial: OversellPolicy | null;
  shopDefault: OversellPolicy | undefined;
  busy: boolean;
  onSave: InventoryTabProps["onSave"];
}

function OversellCard({
  initial,
  shopDefault,
  busy,
  onSave,
}: OversellCardProps): JSX.Element {
  const [value, setValue] = useState<string>(initial ?? USE_SHOP);
  const dirty = value !== (initial ?? USE_SHOP);

  return (
    <Card>
      <BlockStack gap="300">
        <Text as="h2" variant="headingMd">
          Oversell policy
        </Text>
        <Select
          label="Behavior when stock runs out"
          options={OVERSELL_OPTIONS}
          value={value}
          onChange={setValue}
          helpText={
            initial === null
              ? `Inheriting shop default: ${describeShopOversell(shopDefault)}.`
              : "This bundle uses its own policy regardless of the shop default."
          }
        />
        <InlineStack align="end">
          <Button
            variant="primary"
            onClick={() =>
              onSave({
                inventoryRules: {
                  oversellPolicy: value === USE_SHOP ? null : value,
                },
              })
            }
            loading={busy}
            disabled={busy || !dirty}
          >
            Save policy
          </Button>
        </InlineStack>
      </BlockStack>
    </Card>
  );
}

// ---------------- Bundle rendering mode ----------------

interface RenderingModeCardProps {
  initial: boolean | null;
  busy: boolean;
  onSave: InventoryTabProps["onSave"];
}

function RenderingModeCard({
  initial,
  busy,
  onSave,
}: RenderingModeCardProps): JSX.Element {
  const [componentOnly, setComponentOnly] = useState<boolean>(initial === true);
  const dirty = componentOnly !== (initial === true);

  return (
    <Card>
      <BlockStack gap="300">
        <Text as="h2" variant="headingMd">
          Bundle rendering mode
        </Text>
        <Banner tone="info">
          <p>
            With component-only mode on, the storefront renders this
            bundle's components individually — each with its own
            Add-to-cart — instead of selling the bundle as one line
            item. Useful for "marketing" bundles where you want the
            visual grouping but not a stand-alone bundle SKU.
          </p>
        </Banner>
        <Checkbox
          label="Render components individually (no bundle line item)"
          checked={componentOnly}
          onChange={setComponentOnly}
        />
        <InlineStack align="end">
          <Button
            variant="primary"
            onClick={() =>
              onSave({
                inventoryRules: {
                  componentOnlyMode: componentOnly === false ? null : true,
                },
              })
            }
            loading={busy}
            disabled={busy || !dirty}
          >
            Save mode
          </Button>
        </InlineStack>
      </BlockStack>
    </Card>
  );
}

// ---------------- Tab shell ----------------

export function InventoryTab(props: InventoryTabProps): JSX.Element {
  const { inventoryRules, shopDefaults, busy, onSave } = props;
  return (
    <BlockStack gap="400">
      <Banner tone="info" title="Storefront enforcement wires up in M-173b">
        <p>
          Inventory rules persist today. The Cart Transform Function
          honors <code>pauseWhenComponentBelow</code> and theme blocks
          honor <code>componentOnlyMode</code> once M-173b lands —
          merchants can set their rules now and BundleForge starts
          enforcing the moment the storefront-side worker is deployed.
        </p>
      </Banner>
      <ThresholdsCard
        initialLowStock={
          typeof inventoryRules.lowStockThreshold === "number"
            ? inventoryRules.lowStockThreshold
            : null
        }
        initialPauseBelow={
          typeof inventoryRules.pauseWhenComponentBelow === "number"
            ? inventoryRules.pauseWhenComponentBelow
            : null
        }
        initialAlert={
          typeof inventoryRules.lowStockAlertEnabled === "boolean"
            ? inventoryRules.lowStockAlertEnabled
            : null
        }
        shopDefaults={shopDefaults}
        busy={busy}
        onSave={onSave}
      />
      <OversellCard
        initial={
          inventoryRules.oversellPolicy === "prevent" ||
          inventoryRules.oversellPolicy === "allow_negative" ||
          inventoryRules.oversellPolicy === "allow_to_zero"
            ? inventoryRules.oversellPolicy
            : null
        }
        shopDefault={shopDefaults.oversellPolicy}
        busy={busy}
        onSave={onSave}
      />
      <RenderingModeCard
        initial={
          typeof inventoryRules.componentOnlyMode === "boolean"
            ? inventoryRules.componentOnlyMode
            : null
        }
        busy={busy}
        onSave={onSave}
      />
    </BlockStack>
  );
}
