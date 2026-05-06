/**
 * Settings page sidebar (M-185).
 *
 * Vertical button list rendered in `Layout.Section variant="oneThird"`
 * on the left of SettingsPage. Replaces the horizontal Polaris
 * `<Tabs>` row that lived above the cards before M-185.
 *
 * Hash routing is owned by SettingsPage; the sidebar just calls
 * onSelect(idx) which maps to the existing selectTab() flow.
 */
import { BlockStack, Box, Button, Text } from "@shopify/polaris";

export interface SidebarTab {
  id: string;
  content: string;
}

export interface SettingsSidebarProps {
  tabs: readonly SidebarTab[];
  activeIndex: number;
  onSelect: (index: number) => void;
}

export function SettingsSidebar({
  tabs,
  activeIndex,
  onSelect,
}: SettingsSidebarProps): JSX.Element {
  return (
    <Box
      padding="200"
      borderColor="border"
      borderWidth="025"
      borderRadius="200"
      background="bg-surface"
    >
      <BlockStack gap="100">
        <Box paddingBlockEnd="100" paddingInlineStart="200">
          <Text as="h2" variant="headingSm" tone="subdued">
            Settings
          </Text>
        </Box>
        {tabs.map((tab, idx) => (
          <Button
            key={tab.id}
            variant={idx === activeIndex ? "primary" : "tertiary"}
            textAlign="start"
            fullWidth
            onClick={() => onSelect(idx)}
          >
            {tab.content}
          </Button>
        ))}
      </BlockStack>
    </Box>
  );
}
