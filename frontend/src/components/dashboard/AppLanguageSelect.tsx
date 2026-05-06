/**
 * App language selector for the dashboard (M-186).
 *
 * Renders a small Polaris Select bound to the merchant's
 * `settings.localization.fallbackLocale`. The same field is
 * editable in the Localization settings tab; this is a
 * one-click shortcut on the dashboard.
 */
import { InlineStack, Select, Spinner, Text } from "@shopify/polaris";

import { LOCALE_LABELS, SUPPORTED_LOCALES } from "../../lib/locales";

export interface AppLanguageSelectProps {
  value: string;
  busy?: boolean;
  onChange: (next: string) => void;
}

export function AppLanguageSelect({
  value,
  busy,
  onChange,
}: AppLanguageSelectProps): JSX.Element {
  const options = SUPPORTED_LOCALES.map((code) => ({
    label: LOCALE_LABELS[code],
    value: code,
  }));
  return (
    <InlineStack gap="200" blockAlign="center">
      <Text as="span" tone="subdued" variant="bodySm">
        App language
      </Text>
      <Select
        label=""
        labelHidden
        options={options}
        value={value}
        onChange={onChange}
        disabled={busy}
      />
      {busy ? <Spinner accessibilityLabel="Saving" size="small" /> : null}
    </InlineStack>
  );
}
