/**
 * Create-bundle flow.
 *
 * Two-column layout:
 *   - LEFT  — chosen type summary (with "Change type" → modal of all 13),
 *             title, description.
 *   - RIGHT — live storefront preview that updates as the merchant edits.
 *
 * Server-side `create()` only requires title + type; items and pricing
 * rules default to empty arrays so the new bundle can be fleshed out
 * from the detail page after save.
 */
import { useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  Banner,
  BlockStack,
  Box,
  Button,
  Card,
  Grid,
  InlineStack,
  Layout,
  Modal,
  Page,
  TextField,
  Text,
} from "@shopify/polaris";

import {
  BUNDLE_TYPE_OPTIONS as TYPES,
  type BundleTypeOption,
  findBundleType,
} from "../components/bundleTypes";
import { StorefrontPreview } from "../components/StorefrontPreview";


interface TypeCardProps {
  option: BundleTypeOption;
  selected: boolean;
  onSelect: () => void;
}

function TypeCard({ option, selected, onSelect }: TypeCardProps): JSX.Element {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      style={{
        padding: 0,
        margin: 0,
        border: selected ? "2px solid #2563eb" : "1px solid #e1e3e5",
        borderRadius: 12,
        background: "white",
        cursor: "pointer",
        textAlign: "left",
        width: "100%",
        boxShadow: selected
          ? "0 0 0 4px rgba(37, 99, 235, 0.15)"
          : "0 1px 2px rgba(15, 23, 42, 0.06)",
        transition: "box-shadow 120ms ease, border-color 120ms ease",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          height: 72,
          background: option.gradient,
          display: "flex",
          alignItems: "flex-end",
          padding: "10px 14px",
          color: "white",
          fontWeight: 600,
          fontSize: 13,
          letterSpacing: 0.2,
        }}
      >
        {option.tagline}
      </div>
      <div style={{ padding: "12px 14px" }}>
        <Text as="h3" variant="headingSm">
          {option.label}
        </Text>
        <Box paddingBlockStart="100">
          <Text as="p" variant="bodySm" tone="subdued">
            {option.description}
          </Text>
        </Box>
        <Box paddingBlockStart="200">
          <Text as="p" variant="bodySm" tone="subdued">
            <em>e.g. {option.example}</em>
          </Text>
        </Box>
      </div>
    </button>
  );
}

/**
 * Some types' Zod validators require numeric config fields up front
 * (`mix_match` needs minItems + maxItems, `build_box` same, `multipack`
 * needs packQuantity). We expose those inline below the Details card
 * so the merchant doesn't get a 400 from the server, and we send the
 * canonical defaults for any type that doesn't need explicit input.
 */
function buildConfig(
  typeId: string,
  raw: { minItems: string; maxItems: string; packQuantity: string },
): Record<string, unknown> {
  const minItems = Number.parseInt(raw.minItems, 10);
  const maxItems = Number.parseInt(raw.maxItems, 10);
  const packQuantity = Number.parseInt(raw.packQuantity, 10);
  switch (typeId) {
    case "mix_match":
      return {
        minItems: Number.isFinite(minItems) ? minItems : 1,
        maxItems: Number.isFinite(maxItems) ? maxItems : 3,
        allowDuplicates: false,
      };
    case "build_box":
      return {
        minItems: Number.isFinite(minItems) ? minItems : 1,
        maxItems: Number.isFinite(maxItems) ? maxItems : 3,
        allowDuplicates: false,
        steps: [],
      };
    case "multipack":
      return {
        packQuantity: Number.isFinite(packQuantity) ? packQuantity : 6,
      };
    case "wholesale":
      return {};
    default:
      // fixed, bogo, bxgy, volume, gift, mystery, sample, subscription,
      // custom — server validators accept passthrough {} for these.
      return {};
  }
}

interface ConfigFieldsProps {
  typeId: string;
  values: { minItems: string; maxItems: string; packQuantity: string };
  onChange: (next: ConfigFieldsProps["values"]) => void;
}

function ConfigFields({ typeId, values, onChange }: ConfigFieldsProps): JSX.Element | null {
  if (typeId === "mix_match" || typeId === "build_box") {
    return (
      <Card>
        <BlockStack gap="300">
          <Text as="h2" variant="headingMd">
            Type configuration
          </Text>
          <Text as="p" tone="subdued">
            How many items can the customer pick?
          </Text>
          <InlineStack gap="400" wrap={false}>
            <Box minWidth="160px">
              <TextField
                label="Min items"
                type="number"
                min={0}
                value={values.minItems}
                onChange={(v) => onChange({ ...values, minItems: v })}
                autoComplete="off"
              />
            </Box>
            <Box minWidth="160px">
              <TextField
                label="Max items"
                type="number"
                min={1}
                value={values.maxItems}
                onChange={(v) => onChange({ ...values, maxItems: v })}
                autoComplete="off"
              />
            </Box>
          </InlineStack>
        </BlockStack>
      </Card>
    );
  }
  if (typeId === "multipack") {
    return (
      <Card>
        <BlockStack gap="300">
          <Text as="h2" variant="headingMd">
            Type configuration
          </Text>
          <Text as="p" tone="subdued">
            How many units in a pack?
          </Text>
          <Box minWidth="200px">
            <TextField
              label="Pack quantity"
              type="number"
              min={1}
              value={values.packQuantity}
              onChange={(v) => onChange({ ...values, packQuantity: v })}
              autoComplete="off"
            />
          </Box>
        </BlockStack>
      </Card>
    );
  }
  return null;
}

interface AiHintState {
  suggestedSkus?: string[];
  suggestedFromAi?: boolean;
}

export function BundleCreatePage(): JSX.Element {
  const navigate = useNavigate();
  const location = useLocation();
  const aiHint = (location.state ?? {}) as AiHintState;
  const aiSkus = aiHint.suggestedFromAi ? aiHint.suggestedSkus ?? [] : [];
  const [type, setType] = useState<string>("fixed");
  const [title, setTitle] = useState(
    aiSkus.length === 2 ? `${aiSkus[0]} + ${aiSkus[1]}` : "",
  );
  const [description, setDescription] = useState("");
  const [config, setConfig] = useState({
    minItems: "1",
    maxItems: "3",
    packQuantity: "6",
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  const selected = useMemo(
    () => TYPES.find((t) => t.id === type) ?? TYPES[0],
    [type],
  );

  async function onSave(): Promise<void> {
    setError(null);
    if (!title.trim()) {
      setError("Title is required.");
      return;
    }
    // Quick client-side validation for the config-requiring types so
    // the merchant gets a clear inline message instead of a server 400.
    if (type === "mix_match" || type === "build_box") {
      const min = Number.parseInt(config.minItems, 10);
      const max = Number.parseInt(config.maxItems, 10);
      if (!Number.isFinite(min) || min < 0) {
        setError("Min items must be a non-negative whole number.");
        return;
      }
      if (!Number.isFinite(max) || max < 1) {
        setError("Max items must be a whole number 1 or greater.");
        return;
      }
      if (max < min) {
        setError("Max items must be greater than or equal to min items.");
        return;
      }
    }
    if (type === "multipack") {
      const pack = Number.parseInt(config.packQuantity, 10);
      if (!Number.isFinite(pack) || pack < 1) {
        setError("Pack quantity must be a whole number 1 or greater.");
        return;
      }
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/v1/bundles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          type,
          description: description || undefined,
          config: buildConfig(type, config),
          items: [],
          pricingRules: [],
        }),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`HTTP ${res.status}: ${text || res.statusText}`);
      }
      const created = (await res.json()) as { id: string };
      navigate(`/bundles/${created.id}`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <Page
        title="Create bundle"
        subtitle="Pick a type, give it a name, and watch the preview update."
        backAction={{ content: "Bundles", url: "/" }}
        primaryAction={{
          content: "Save & continue",
          onAction: onSave,
          loading: submitting,
          disabled: submitting,
        }}
      >
        <BlockStack gap="400">
          {error && (
            <Banner tone="critical" title="Could not create bundle">
              {error}
            </Banner>
          )}

          {aiSkus.length === 2 && (
            <Banner tone="info" title="Suggested by AI from your order history">
              <p>
                Customers buy <strong>{aiSkus[0]}</strong> and{" "}
                <strong>{aiSkus[1]}</strong> together more often than
                chance. We've pre-filled a working title — pick a
                bundle type below, save, then add these two products
                from the picker on the next page.
              </p>
            </Banner>
          )}

          <Layout>
            <Layout.Section>
              <BlockStack gap="400">
                {/* Selected type summary card with Change button. */}
                <Card>
                  <BlockStack gap="300">
                    <InlineStack align="space-between" blockAlign="center">
                      <Text as="h2" variant="headingMd">
                        Bundle type
                      </Text>
                      <Button onClick={() => setPickerOpen(true)}>
                        Change type
                      </Button>
                    </InlineStack>
                    <div
                      style={{
                        display: "flex",
                        gap: 16,
                        alignItems: "stretch",
                      }}
                    >
                      <div
                        style={{
                          width: 96,
                          minHeight: 64,
                          borderRadius: 8,
                          background: selected.gradient,
                        }}
                      />
                      <BlockStack gap="100">
                        <Text as="h3" variant="headingSm">
                          {selected.label}
                        </Text>
                        <Text as="p" tone="subdued">
                          {selected.description}
                        </Text>
                        <Text as="p" variant="bodySm" tone="subdued">
                          <em>e.g. {selected.example}</em>
                        </Text>
                      </BlockStack>
                    </div>
                  </BlockStack>
                </Card>

                {/* Type-specific config (only for the 3 types whose
                    Zod validators require numeric fields up front). */}
                <ConfigFields
                  typeId={type}
                  values={config}
                  onChange={setConfig}
                />

                {/* Title + description. */}
                <Card>
                  <BlockStack gap="300">
                    <Text as="h2" variant="headingMd">
                      Details
                    </Text>
                    <TextField
                      label="Title"
                      value={title}
                      onChange={setTitle}
                      autoComplete="off"
                      placeholder={`${selected.label} — `}
                      requiredIndicator
                      helpText="Shown to merchants in the admin and to customers as the bundle's product title."
                    />
                    <TextField
                      label="Description (optional)"
                      value={description}
                      onChange={setDescription}
                      autoComplete="off"
                      multiline={3}
                      helpText="Short marketing copy. Appears under the title on the bundle's product page."
                    />
                  </BlockStack>
                </Card>

                <Box>
                  <Text as="p" variant="bodySm" tone="subdued">
                    Save & continue takes you to the bundle detail page,
                    where you'll add items, configure pricing rules, and
                    publish to your storefront.
                  </Text>
                </Box>
              </BlockStack>
            </Layout.Section>

            <Layout.Section variant="oneThird">
              <StorefrontPreview
                type={selected}
                title={title}
                description={description}
              />
            </Layout.Section>
          </Layout>
        </BlockStack>
      </Page>

      <Modal
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        title="Choose a bundle type"
        size="large"
      >
        <Modal.Section>
          <BlockStack gap="300">
            <Text as="p" tone="subdued">
              Each type maps to a specific buying behavior. Most stores
              start with <strong>Fixed</strong> or <strong>Mix &amp;
              match</strong>; you can change later.
            </Text>
            <Grid>
              {TYPES.map((opt) => (
                <Grid.Cell
                  key={opt.id}
                  columnSpan={{ xs: 6, sm: 4, md: 3, lg: 3, xl: 3 }}
                >
                  <TypeCard
                    option={opt}
                    selected={opt.id === type}
                    onSelect={() => {
                      setType(opt.id);
                      setPickerOpen(false);
                    }}
                  />
                </Grid.Cell>
              ))}
            </Grid>
          </BlockStack>
        </Modal.Section>
      </Modal>
    </>
  );
}
