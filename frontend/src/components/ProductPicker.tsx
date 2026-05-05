/**
 * Visual builder — product picker (M-099).
 *
 * Stub UI that lists currently-attached items. The Shopify Resource
 * Picker integration that lets merchants add new items lands when the
 * App Bridge ResourcePicker action is wired (a follow-up).
 */
import { Card, ResourceList, ResourceItem, Text } from "@shopify/polaris";

interface PickerItem {
  id: string;
  title: string;
  shopifyProductGid: string;
  quantity: number;
}

export interface ProductPickerProps {
  initial: PickerItem[];
}

export function ProductPicker({ initial }: ProductPickerProps): JSX.Element {
  return (
    <Card>
      <Text as="h2" variant="headingMd">
        Items
      </Text>
      <ResourceList
        items={initial}
        renderItem={(item: PickerItem) => (
          <ResourceItem
            id={item.id}
            url={item.shopifyProductGid}
            accessibilityLabel={`Edit ${item.title}`}
          >
            <Text as="span" fontWeight="semibold">
              {item.title}
            </Text>
            <div>Qty: {item.quantity}</div>
          </ResourceItem>
        )}
      />
    </Card>
  );
}
