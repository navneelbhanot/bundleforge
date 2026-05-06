/**
 * Templates / preset gallery modal (M-179).
 *
 * Renders the read-only registry from
 * GET /api/v1/bundles/templates as a grid of cards. Each card
 * has a "Use this template" button that triggers an
 * instantiate POST upstream. The modal owns no state beyond
 * the local category filter — all fetching + navigation is
 * driven from the parent.
 */
import { useMemo, useState } from "react";
import {
  Badge,
  BlockStack,
  Box,
  Button,
  Card,
  ChoiceList,
  Grid,
  InlineStack,
  Modal,
  Text,
} from "@shopify/polaris";

export type TemplateCategory =
  | "promo"
  | "seasonal"
  | "subscription"
  | "starter";

export interface BundleTemplate {
  id: string;
  label: string;
  description: string;
  category: TemplateCategory;
  type: string;
  defaultTitle: string;
}

const CATEGORY_LABEL: Record<TemplateCategory, string> = {
  promo: "Promo",
  seasonal: "Seasonal",
  subscription: "Subscription",
  starter: "Starter",
};

const CATEGORY_TONE: Record<
  TemplateCategory,
  "success" | "info" | "warning" | "attention"
> = {
  promo: "success",
  seasonal: "warning",
  subscription: "info",
  starter: "attention",
};

const CATEGORY_CHOICES: Array<{ label: string; value: TemplateCategory }> = [
  { label: "Promo", value: "promo" },
  { label: "Seasonal", value: "seasonal" },
  { label: "Subscription", value: "subscription" },
  { label: "Starter", value: "starter" },
];

export interface TemplatesModalProps {
  open: boolean;
  templates: BundleTemplate[];
  busy: boolean;
  /** Returns the new bundle's id; the parent navigates. */
  onUseTemplate: (templateId: string) => Promise<void>;
  onClose: () => void;
}

export function TemplatesModal(props: TemplatesModalProps): JSX.Element {
  const { open, templates, busy, onUseTemplate, onClose } = props;
  const [selected, setSelected] = useState<TemplateCategory[]>([]);

  const visible = useMemo(() => {
    if (selected.length === 0) return templates;
    const set = new Set(selected);
    return templates.filter((t) => set.has(t.category));
  }, [selected, templates]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Browse templates"
      size="large"
      secondaryActions={[{ content: "Cancel", onAction: onClose }]}
    >
      <Modal.Section>
        <BlockStack gap="400">
          <Text as="p" tone="subdued">
            Pick a starter that matches the promotion shape you
            want. We'll create a draft pre-configured with the
            right type + pricing rules; you add your products
            afterwards.
          </Text>
          <ChoiceList
            allowMultiple
            title="Filter by category"
            choices={CATEGORY_CHOICES}
            selected={selected}
            onChange={(next) =>
              setSelected(next as TemplateCategory[])
            }
          />
          {visible.length === 0 ? (
            <Text as="p" tone="subdued">
              No templates match that filter.
            </Text>
          ) : (
            <Grid>
              {visible.map((t) => (
                <Grid.Cell
                  key={t.id}
                  columnSpan={{ xs: 6, sm: 6, md: 4, lg: 4, xl: 4 }}
                >
                  <Card>
                    <BlockStack gap="200">
                      <InlineStack align="space-between" blockAlign="center">
                        <Badge tone={CATEGORY_TONE[t.category]}>
                          {CATEGORY_LABEL[t.category]}
                        </Badge>
                        <Text as="span" variant="bodySm" tone="subdued">
                          {t.type}
                        </Text>
                      </InlineStack>
                      <Text as="h3" variant="headingMd">
                        {t.label}
                      </Text>
                      <Text as="p" tone="subdued">
                        {t.description}
                      </Text>
                      <Box>
                        <InlineStack align="end">
                          <Button
                            variant="primary"
                            disabled={busy}
                            loading={busy}
                            onClick={() => onUseTemplate(t.id)}
                          >
                            Use this template
                          </Button>
                        </InlineStack>
                      </Box>
                    </BlockStack>
                  </Card>
                </Grid.Cell>
              ))}
            </Grid>
          )}
        </BlockStack>
      </Modal.Section>
    </Modal>
  );
}
