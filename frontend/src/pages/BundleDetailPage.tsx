/**
 * Bundle detail page (M-098).
 *
 * Status-aware primary action (Publish / Archive / Unarchive),
 * editable pricing rules, items list with a clear empty state, and
 * live storefront preview side-by-side. Title + description are
 * editable inline; saving any of those fires PUT /api/v1/bundles/:id.
 */
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import {
  Badge,
  BlockStack,
  Box,
  Banner,
  Button,
  Card,
  EmptyState,
  Frame,
  InlineStack,
  Layout,
  Page,
  Text,
  TextField,
  Toast,
} from "@shopify/polaris";

import { findBundleType } from "../components/bundleTypes";
import { PageLoading } from "../components/PageLoading";
import {
  PricingRulesEditor,
  type PricingRuleRow,
} from "../components/PricingRulesEditor";
import { StorefrontPreview } from "../components/StorefrontPreview";
import { TypeConfigPanel } from "../components/TypeConfigPanel";

interface BundleItem {
  id?: string;
  title: string;
  shopifyProductGid: string;
  shopifyVariantGid?: string;
  sku?: string;
  quantity: number;
}

/**
 * App Bridge v4 exposes a native ResourcePicker via `shopify.resourcePicker`.
 * Loose typing: the global comes from a CDN script and isn't packaged with
 * a TypeScript type, so we describe just the shape we use.
 */
interface AppBridgeResourcePickerResult {
  id: string;
  title: string;
  variants?: Array<{ id: string; title?: string; sku?: string | null }>;
}
interface AppBridgeShopify {
  idToken?: () => Promise<string>;
  resourcePicker?: (opts: {
    type: "product" | "variant" | "collection";
    multiple?: boolean;
    selectionIds?: Array<{ id: string }>;
  }) => Promise<AppBridgeResourcePickerResult[] | undefined>;
}
function getShopify(): AppBridgeShopify | null {
  return (window as unknown as { shopify?: AppBridgeShopify }).shopify ?? null;
}

interface BundleDetail {
  id: string;
  title: string;
  slug?: string;
  type: string;
  status: "draft" | "active" | "archived" | string;
  description: string | null;
  config: Record<string, unknown>;
  items: BundleItem[];
  pricingRules?: PricingRuleRow[];
}

function statusTone(status: string): "success" | "info" | "warning" | "attention" {
  if (status === "active") return "success";
  if (status === "archived") return "warning";
  if (status === "draft") return "attention";
  return "info";
}

export function BundleDetailPage(): JSX.Element {
  const { id } = useParams<{ id: string }>();
  const [bundle, setBundle] = useState<BundleDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Editable form state. Synced from `bundle` on load and after every
  // server response. We compare against `bundle` to detect dirty fields.
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [rules, setRules] = useState<PricingRuleRow[]>([]);
  const [items, setItems] = useState<BundleItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [pickerBusy, setPickerBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  function hydrate(b: BundleDetail): void {
    setBundle(b);
    setTitle(b.title);
    setDescription(b.description ?? "");
    setRules(b.pricingRules ?? []);
    setItems(b.items);
  }

  async function pickProducts(): Promise<void> {
    const shopify = getShopify();
    if (!shopify?.resourcePicker) {
      setToast(
        "Product picker only works inside the Shopify admin. Use the dev store install link.",
      );
      return;
    }
    setPickerBusy(true);
    try {
      const selectionIds = items
        .filter((it) => it.shopifyProductGid)
        .map((it) => ({ id: it.shopifyProductGid }));
      const picked = await shopify.resourcePicker({
        type: "product",
        multiple: true,
        selectionIds,
      });
      if (!picked) return; // merchant cancelled
      // Merge: keep existing items whose gid is still selected (preserve
      // their quantity), and add new ones with quantity 1.
      const stillSelected = new Set(picked.map((p) => p.id));
      const kept = items.filter((it) => stillSelected.has(it.shopifyProductGid));
      const keptGids = new Set(kept.map((it) => it.shopifyProductGid));
      const added: BundleItem[] = picked
        .filter((p) => !keptGids.has(p.id))
        .map((p) => ({
          title: p.title,
          shopifyProductGid: p.id,
          shopifyVariantGid: p.variants?.[0]?.id,
          sku: p.variants?.[0]?.sku ?? undefined,
          quantity: 1,
        }));
      setItems([...kept, ...added]);
    } catch (e) {
      setToast(`Picker error: ${(e as Error).message}`);
    } finally {
      setPickerBusy(false);
    }
  }

  function removeItem(idx: number): void {
    setItems(items.filter((_, i) => i !== idx));
  }

  function setItemQuantity(idx: number, qty: string): void {
    const n = Number.parseInt(qty, 10);
    setItems(
      items.map((it, i) =>
        i === idx ? { ...it, quantity: Number.isFinite(n) && n > 0 ? n : 1 } : it,
      ),
    );
  }

  useEffect(() => {
    if (!id) return;
    fetch(`/api/v1/bundles/${id}`)
      .then((r) =>
        r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`)),
      )
      .then(hydrate)
      .catch((e: Error) => setError(e.message));
  }, [id]);

  async function save(patch: Partial<BundleDetail> & { pricingRules?: PricingRuleRow[] }): Promise<void> {
    if (!id) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/bundles/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`HTTP ${res.status}: ${text || res.statusText}`);
      }
      const fresh = (await res.json()) as BundleDetail;
      hydrate(fresh);
      setToast("Saved");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function statusAction(path: "publish" | "archive"): Promise<void> {
    if (!id) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/bundles/${id}/${path}`, {
        method: "POST",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const fresh = (await res.json()) as BundleDetail;
      hydrate(fresh);
      setToast(path === "publish" ? "Bundle published" : "Bundle archived");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (error && !bundle) {
    return (
      <Page title="Bundle" backAction={{ content: "Bundles", url: "/" }}>
        <Card>
          <Text as="p" tone="critical">
            {error}
          </Text>
        </Card>
      </Page>
    );
  }
  if (!bundle) {
    return <PageLoading title="Bundle" variant="detail" />;
  }

  const detailsDirty =
    title !== bundle.title || description !== (bundle.description ?? "");

  // Choose the right primary action based on current status.
  const primary =
    bundle.status === "active"
      ? {
          content: "Archive",
          onAction: () => statusAction("archive"),
          loading: busy,
          disabled: busy,
        }
      : bundle.status === "archived"
        ? {
            // Server has no "unarchive" endpoint — use update() to flip
            // status back to draft, which is the practical reverse.
            content: "Move to draft",
            onAction: () => save({ status: "draft" } as Partial<BundleDetail>),
            loading: busy,
            disabled: busy,
          }
        : {
            content: "Publish",
            onAction: () => statusAction("publish"),
            loading: busy,
            disabled: busy,
          };

  return (
    <Frame>
      <Page
        title={bundle.title}
        titleMetadata={
          <InlineStack gap="200">
            <Badge tone={statusTone(bundle.status)}>{bundle.status}</Badge>
            <Badge>{bundle.type}</Badge>
          </InlineStack>
        }
        backAction={{ content: "Bundles", url: "/" }}
        primaryAction={primary}
      >
        <BlockStack gap="400">
          {error && <Banner tone="critical">{error}</Banner>}

          <Layout>
            <Layout.Section>
              <BlockStack gap="400">
                {/* Details — title + description, savable independently. */}
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
                    />
                    <TextField
                      label="Description"
                      value={description}
                      onChange={setDescription}
                      autoComplete="off"
                      multiline={3}
                    />
                    <InlineStack align="end">
                      <Button
                        onClick={() =>
                          save({
                            title,
                            description: description || undefined,
                          } as Partial<BundleDetail>)
                        }
                        loading={busy}
                        disabled={busy || !detailsDirty}
                      >
                        Save details
                      </Button>
                    </InlineStack>
                  </BlockStack>
                </Card>

                {/* Items. Native Shopify ResourcePicker via App Bridge
                    + per-row quantity + remove. Save Items button
                    persists via PUT. */}
                <Card>
                  <BlockStack gap="300">
                    <InlineStack align="space-between" blockAlign="center">
                      <Text as="h2" variant="headingMd">
                        Items
                      </Text>
                      <Button
                        onClick={pickProducts}
                        loading={pickerBusy}
                        disabled={pickerBusy || busy}
                        variant="primary"
                      >
                        {items.length === 0 ? "Add products" : "Edit products"}
                      </Button>
                    </InlineStack>
                    {items.length === 0 ? (
                      <EmptyState
                        heading="No items yet"
                        image=""
                        action={{
                          content: "Add products",
                          onAction: pickProducts,
                          loading: pickerBusy,
                        }}
                      >
                        <p>
                          A bundle is a set of products. Click{" "}
                          <strong>Add products</strong> to choose what's in
                          this bundle from your Shopify catalog.
                        </p>
                      </EmptyState>
                    ) : (
                      <BlockStack gap="200">
                        {items.map((item, idx) => (
                          <Box
                            key={item.shopifyProductGid + idx}
                            background="bg-surface-secondary"
                            padding="300"
                            borderRadius="200"
                          >
                            <InlineStack
                              align="space-between"
                              blockAlign="center"
                              gap="300"
                            >
                              <BlockStack gap="050">
                                <Text as="p" fontWeight="semibold">
                                  {item.title}
                                </Text>
                                {item.sku && (
                                  <Text as="p" variant="bodySm" tone="subdued">
                                    SKU: {item.sku}
                                  </Text>
                                )}
                              </BlockStack>
                              <InlineStack gap="200" blockAlign="center">
                                <Box minWidth="80px">
                                  <TextField
                                    label="Qty"
                                    labelHidden
                                    type="number"
                                    min={1}
                                    value={String(item.quantity)}
                                    onChange={(v) => setItemQuantity(idx, v)}
                                    autoComplete="off"
                                  />
                                </Box>
                                <Button
                                  onClick={() => removeItem(idx)}
                                  variant="tertiary"
                                  tone="critical"
                                >
                                  Remove
                                </Button>
                              </InlineStack>
                            </InlineStack>
                          </Box>
                        ))}
                        <InlineStack align="end">
                          <Button
                            onClick={() => save({ items } as Partial<BundleDetail>)}
                            loading={busy}
                            disabled={busy}
                          >
                            Save items
                          </Button>
                        </InlineStack>
                      </BlockStack>
                    )}
                  </BlockStack>
                </Card>

                {/* Pricing rules — editor + Save Pricing button. */}
                <BlockStack gap="200">
                  <PricingRulesEditor
                    initial={rules}
                    onChange={setRules}
                  />
                  <InlineStack align="end">
                    <Button
                      onClick={() => save({ pricingRules: rules })}
                      loading={busy}
                      disabled={busy}
                    >
                      Save pricing rules
                    </Button>
                  </InlineStack>
                </BlockStack>

                {/* Type-specific config (read-only display until per-type
                    editor lands for all 13 types). */}
                <TypeConfigPanel type={bundle.type} config={bundle.config} />
              </BlockStack>
            </Layout.Section>

            <Layout.Section variant="oneThird">
              <Card>
                <BlockStack gap="200">
                  <Text as="h3" variant="headingSm">
                    Status
                  </Text>
                  <Box>
                    <Badge tone={statusTone(bundle.status)}>
                      {bundle.status}
                    </Badge>
                  </Box>
                  <Text as="p" tone="subdued" variant="bodySm">
                    {bundle.status === "draft"
                      ? "Drafts are invisible to customers. Publish when items + pricing are ready."
                      : bundle.status === "active"
                        ? "This bundle is live. Customers can add it to cart."
                        : "Archived bundles are hidden from the storefront. Move to draft to edit and republish."}
                  </Text>
                </BlockStack>
              </Card>

              <Box paddingBlockStart="400">
                <Card>
                  <BlockStack gap="200">
                    <Text as="h3" variant="headingSm">
                      Quick stats
                    </Text>
                    <InlineStack gap="400">
                      <Box>
                        <Text as="p" variant="bodySm" tone="subdued">
                          Items
                        </Text>
                        <Text as="p" variant="headingMd">
                          {items.length}
                        </Text>
                      </Box>
                      <Box>
                        <Text as="p" variant="bodySm" tone="subdued">
                          Pricing rules
                        </Text>
                        <Text as="p" variant="headingMd">
                          {rules.length}
                        </Text>
                      </Box>
                    </InlineStack>
                  </BlockStack>
                </Card>
              </Box>

              {/* Live storefront preview — updates as the merchant
                  edits items, title, description, or pricing rules. */}
              <Box paddingBlockStart="400">
                <StorefrontPreview
                  type={findBundleType(bundle.type)}
                  title={title || bundle.title}
                  description={description}
                  items={items}
                  pricingRules={rules}
                />
              </Box>
            </Layout.Section>
          </Layout>
        </BlockStack>
      </Page>

      {toast && <Toast content={toast} onDismiss={() => setToast(null)} />}
    </Frame>
  );
}
