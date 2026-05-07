/**
 * Bundle detail page (M-098).
 *
 * Status-aware primary action (Publish / Archive / Unarchive),
 * editable pricing rules, items list with a clear empty state, and
 * live storefront preview side-by-side. Title + description are
 * editable inline; saving any of those fires PUT /api/v1/bundles/:id.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
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
  Tabs,
  Text,
  TextField,
} from "@shopify/polaris";

import { ToastHost, useToasts } from "../components/shell/Toasts";
import { getIllustration } from "../components/shell/illustrations";
import { findBundleType } from "../components/bundleTypes";
import { ActivityTab } from "../components/bundleDetail/ActivityTab";
import { AdvancedTab } from "../components/bundleDetail/AdvancedTab";
import {
  CustomersTab,
  type Eligibility,
} from "../components/bundleDetail/CustomersTab";
import {
  DisplayTab,
  type DisplaySettings,
  type ShopDisplayDefaults,
} from "../components/bundleDetail/DisplayTab";
import {
  InventoryTab,
  type InventoryRules,
  type ShopInventoryDefaults,
} from "../components/bundleDetail/InventoryTab";
import { PerformanceTab } from "../components/bundleDetail/PerformanceTab";
import {
  ScheduleTab,
  type ScheduleSettings,
} from "../components/bundleDetail/ScheduleTab";
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
  startsAt?: string | null;
  endsAt?: string | null;
  scheduleSettings?: ScheduleSettings;
  displaySettings?: DisplaySettings;
  eligibility?: Eligibility;
  inventoryRules?: InventoryRules;
  seoTitle?: string | null;
  seoDescription?: string | null;
  shopTimezone?: string;
}

function statusTone(status: string): "success" | "info" | "warning" | "attention" {
  if (status === "active") return "success";
  if (status === "archived") return "warning";
  if (status === "draft") return "attention";
  return "info";
}

interface TabSpec {
  id: string;
  hash: string;
  content: string;
}

const TABS: TabSpec[] = [
  { id: "setup", hash: "setup", content: "Setup" },
  { id: "schedule", hash: "schedule", content: "Schedule" },
  { id: "display", hash: "display", content: "Display" },
  { id: "customers", hash: "customers", content: "Customers" },
  { id: "inventory", hash: "inventory", content: "Inventory" },
  { id: "performance", hash: "performance", content: "Performance" },
  { id: "activity", hash: "activity", content: "Activity" },
  { id: "advanced", hash: "advanced", content: "Advanced" },
];

function readHashTab(): number {
  if (typeof window === "undefined") return 0;
  const hash = window.location.hash.replace(/^#/, "");
  if (!hash) return 0;
  const idx = TABS.findIndex((t) => t.hash === hash);
  return idx >= 0 ? idx : 0;
}

function writeHashTab(idx: number): void {
  if (typeof window === "undefined") return;
  const hash = TABS[idx]?.hash ?? "setup";
  if (window.location.hash !== `#${hash}`) {
    window.history.replaceState(null, "", `#${hash}`);
  }
}

export function BundleDetailPage(): JSX.Element {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
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
  const { show: showToast } = useToasts();
  const [tabIndex, setTabIndex] = useState<number>(readHashTab());
  // Track which tabs the merchant has visited so we can keep them
  // mounted (display:none when inactive). First visit pays the
  // mount + fetch cost; every subsequent switch is instant. The
  // Setup tab is always mounted so its in-flight form edits never
  // get discarded.
  const [visitedTabs, setVisitedTabs] = useState<Set<string>>(
    () => new Set(["setup", TABS[readHashTab()].id]),
  );
  useEffect(() => {
    const id = TABS[tabIndex].id;
    setVisitedTabs((prev) => {
      if (prev.has(id)) return prev;
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  }, [tabIndex]);
  const isMounted = useCallback(
    (id: string): boolean => visitedTabs.has(id),
    [visitedTabs],
  );
  const tabStyle = useCallback(
    (id: string): React.CSSProperties => ({
      display: TABS[tabIndex].id === id ? "block" : "none",
    }),
    [tabIndex],
  );
  const [shopDisplayDefaults, setShopDisplayDefaults] =
    useState<ShopDisplayDefaults | null>(null);
  const [shopInventoryDefaults, setShopInventoryDefaults] =
    useState<ShopInventoryDefaults | null>(null);

  // Fetch shop-level Display defaults lazily — only when the
  // merchant lands on / switches to the Display tab. Avoids the
  // extra GET on every Bundle Detail load.
  useEffect(() => {
    if (TABS[tabIndex].id !== "display") return;
    if (shopDisplayDefaults !== null) return;
    fetch("/api/v1/settings")
      .then((r) =>
        r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`)),
      )
      .then((body: { display?: ShopDisplayDefaults }) =>
        setShopDisplayDefaults(body.display ?? {}),
      )
      .catch(() => setShopDisplayDefaults({}));
  }, [tabIndex, shopDisplayDefaults]);

  // Same lazy-fetch pattern for shop-level Inventory defaults.
  useEffect(() => {
    if (TABS[tabIndex].id !== "inventory") return;
    if (shopInventoryDefaults !== null) return;
    fetch("/api/v1/settings")
      .then((r) =>
        r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`)),
      )
      .then((body: { inventory?: ShopInventoryDefaults }) =>
        setShopInventoryDefaults(body.inventory ?? {}),
      )
      .catch(() => setShopInventoryDefaults({}));
  }, [tabIndex, shopInventoryDefaults]);

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

  const polarisTabs = useMemo(
    () =>
      TABS.map((t) => ({
        id: t.id,
        content: t.content,
        accessibilityLabel: t.content,
        panelID: `panel-bundle-${t.id}`,
      })),
    [],
  );

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
      showToast(
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
      showToast(`Picker error: ${(e as Error).message}`);
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
      showToast("Saved");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function duplicate(): Promise<void> {
    if (!id) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/bundles/${id}/duplicate`, {
        method: "POST",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const fresh = (await res.json()) as { id: string };
      navigate(`/bundles/${fresh.id}#setup`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function deleteBundle(): Promise<void> {
    if (!id) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/bundles/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      navigate("/");
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
      showToast(path === "publish" ? "Bundle published" : "Bundle archived");
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

          <Tabs
            tabs={polarisTabs}
            selected={tabIndex}
            onSelect={selectTab}
            fitted={false}
          />

          <Layout>
            <Layout.Section>
              {/* Each tab uses a mount-once-stay-mounted pattern:
                  the first time the merchant visits, the tab's
                  component mounts (and any data fetch fires); on
                  subsequent switches the tab is just toggled with
                  display:none so the React state + fetched data
                  are preserved. Setup is in the visited set from
                  the start so its in-flight form edits never get
                  discarded. */}
              {isMounted("schedule") && (
                <div style={tabStyle("schedule")}>
                  <Box paddingBlockEnd="400">
                    <ScheduleTab
                      startsAt={bundle.startsAt ?? null}
                      endsAt={bundle.endsAt ?? null}
                      scheduleSettings={bundle.scheduleSettings ?? {}}
                      shopTimezone={bundle.shopTimezone ?? "UTC"}
                      busy={busy}
                      onSave={(patch) => save(patch as Partial<BundleDetail>)}
                    />
                  </Box>
                </div>
              )}
              {isMounted("display") && (
                <div style={tabStyle("display")}>
                  <Box paddingBlockEnd="400">
                    <DisplayTab
                      bundleDisplay={bundle.displaySettings ?? {}}
                      shopDefaults={shopDisplayDefaults ?? {}}
                      busy={busy}
                      onSave={(patch) => save(patch as Partial<BundleDetail>)}
                    />
                  </Box>
                </div>
              )}
              {isMounted("customers") && (
                <div style={tabStyle("customers")}>
                  <Box paddingBlockEnd="400">
                    <CustomersTab
                      eligibility={bundle.eligibility ?? {}}
                      busy={busy}
                      onSave={(patch) => save(patch as Partial<BundleDetail>)}
                    />
                  </Box>
                </div>
              )}
              {isMounted("inventory") && (
                <div style={tabStyle("inventory")}>
                  <Box paddingBlockEnd="400">
                    <InventoryTab
                      inventoryRules={bundle.inventoryRules ?? {}}
                      shopDefaults={shopInventoryDefaults ?? {}}
                      busy={busy}
                      onSave={(patch) => save(patch as Partial<BundleDetail>)}
                    />
                  </Box>
                </div>
              )}
              {isMounted("performance") && (
                <div style={tabStyle("performance")}>
                  <Box paddingBlockEnd="400">
                    <PerformanceTab bundleId={bundle.id} />
                  </Box>
                </div>
              )}
              {isMounted("activity") && (
                <div style={tabStyle("activity")}>
                  <Box paddingBlockEnd="400">
                    <ActivityTab bundleId={bundle.id} />
                  </Box>
                </div>
              )}
              {isMounted("advanced") && (
                <div style={tabStyle("advanced")}>
                  <Box paddingBlockEnd="400">
                    <AdvancedTab
                      bundleId={bundle.id}
                      initialSeoTitle={bundle.seoTitle ?? null}
                      initialSeoDescription={bundle.seoDescription ?? null}
                      rawConfig={{
                        config: bundle.config,
                        displaySettings: bundle.displaySettings ?? {},
                        scheduleSettings: bundle.scheduleSettings ?? {},
                        eligibility: bundle.eligibility ?? {},
                        inventoryRules: bundle.inventoryRules ?? {},
                      }}
                      busy={busy}
                      onSave={(patch) => save(patch as Partial<BundleDetail>)}
                      onDuplicate={duplicate}
                      onDelete={deleteBundle}
                    />
                  </Box>
                </div>
              )}
              <div
                style={{
                  display: TABS[tabIndex].id === "setup" ? "block" : "none",
                }}
              >
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
                        image={getIllustration("inventory")}
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
              </div>
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

      <ToastHost />
    </Frame>
  );
}
