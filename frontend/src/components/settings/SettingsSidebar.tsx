/**
 * Settings page sidebar (M-185, polished M-185.1).
 *
 * Vertical nav rendered in `Layout.Section variant="oneThird"` on
 * the left of SettingsPage. Replaces the horizontal Polaris
 * `<Tabs>` row that lived above the cards before M-185.
 *
 * Design notes:
 * - Each item: small icon + label, button-styled but rendered as
 *   an HTML `<button>` (Polaris Button felt too heavy at this
 *   density — fullWidth primary variant is solid black, which
 *   reads as a CTA rather than a selected nav item).
 * - Active state: subtle blue tint (`bg-surface-selected`) plus a
 *   left-edge accent stripe rendered via box-shadow inset so the
 *   selected section is obvious without dominating the pane.
 * - Hover state: `bg-surface-hover` background; uses a CSS
 *   `:hover` selector via inline style so we don't need to
 *   register a stylesheet.
 *
 * Hash routing is owned by SettingsPage; the sidebar just calls
 * onSelect(idx) which maps to the existing selectTab() flow.
 */
import {
  AppsIcon,
  CartIcon,
  CashDollarIcon,
  ColorIcon,
  CreditCardIcon,
  GlobeIcon,
  InventoryIcon,
  KeyIcon,
  NotificationIcon,
  SettingsIcon,
} from "@shopify/polaris-icons";
import { BlockStack, Box, Icon, InlineStack, Text } from "@shopify/polaris";
import { useTranslation } from "react-i18next";

export interface SidebarTab {
  id: string;
  /** Default English label — overridden by i18n.t("settings.<id>")
   *  if present in the active locale. Kept on the type so existing
   *  call sites (and tests) don't break. */
  content: string;
}

export interface SettingsSidebarProps {
  tabs: readonly SidebarTab[];
  activeIndex: number;
  onSelect: (index: number) => void;
}

const ICONS: Record<string, typeof SettingsIcon> = {
  general: SettingsIcon,
  display: ColorIcon,
  inventory: InventoryIcon,
  pricing: CashDollarIcon,
  cart: CartIcon,
  notifications: NotificationIcon,
  integrations: AppsIcon,
  api: KeyIcon,
  localization: GlobeIcon,
  billing: CreditCardIcon,
};

interface SidebarItemProps {
  active: boolean;
  icon: typeof SettingsIcon;
  label: string;
  onClick: () => void;
}

function SidebarItem({ active, icon, label, onClick }: SidebarItemProps): JSX.Element {
  const baseStyle: React.CSSProperties = {
    display: "block",
    width: "100%",
    padding: "8px 10px",
    border: "none",
    borderRadius: "8px",
    cursor: "pointer",
    textAlign: "left",
    background: active ? "var(--p-color-bg-surface-selected)" : "transparent",
    color: active
      ? "var(--p-color-text-emphasis)"
      : "var(--p-color-text)",
    fontWeight: active ? 600 : 500,
    transition: "background 120ms ease",
    boxShadow: active
      ? "inset 3px 0 0 var(--p-color-border-emphasis)"
      : "none",
  };
  return (
    <button
      type="button"
      onClick={onClick}
      style={baseStyle}
      onMouseEnter={(e) => {
        if (!active) {
          e.currentTarget.style.background = "var(--p-color-bg-surface-hover)";
        }
      }}
      onMouseLeave={(e) => {
        if (!active) {
          e.currentTarget.style.background = "transparent";
        }
      }}
    >
      <InlineStack gap="200" blockAlign="center" wrap={false}>
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: 16,
            height: 16,
          }}
        >
          <Icon source={icon} tone={active ? "emphasis" : "subdued"} />
        </span>
        <Text as="span" variant="bodyMd" fontWeight={active ? "semibold" : "medium"}>
          {label}
        </Text>
      </InlineStack>
    </button>
  );
}

export function SettingsSidebar({
  tabs,
  activeIndex,
  onSelect,
}: SettingsSidebarProps): JSX.Element {
  const { t } = useTranslation();
  return (
    <Box
      padding="100"
      borderColor="border"
      borderWidth="025"
      borderRadius="300"
      background="bg-surface"
    >
      <BlockStack gap="025">
        {tabs.map((tab, idx) => {
          // Prefer the translated label (`settings.<id>`); fall back
          // to the prop-supplied content if no translation exists.
          const translated = t(`settings.${tab.id}`, {
            defaultValue: tab.content,
          });
          return (
            <SidebarItem
              key={tab.id}
              active={idx === activeIndex}
              icon={ICONS[tab.id] ?? SettingsIcon}
              label={translated}
              onClick={() => onSelect(idx)}
            />
          );
        })}
      </BlockStack>
    </Box>
  );
}
