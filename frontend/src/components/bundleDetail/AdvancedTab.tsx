/**
 * Bundle Detail · Advanced tab (M-175). Closes Phase R2.
 *
 * Three cards collect the surfaces that don't fit elsewhere:
 *  - Search engine listing: edit seoTitle + seoDescription.
 *  - Raw configuration: read-only JSON inspector for the 5
 *    per-bundle JSON columns (debugging / ticket submission).
 *  - Danger zone: Duplicate (clones the bundle) and Delete
 *    (soft-delete with typed confirmation).
 */
import { useState } from "react";
import {
  Banner,
  BlockStack,
  Button,
  Card,
  Collapsible,
  InlineStack,
  Modal,
  Text,
  TextField,
} from "@shopify/polaris";

const SEO_TITLE_MAX = 60;
const SEO_DESCRIPTION_MAX = 320;

export interface AdvancedTabProps {
  bundleId: string;
  initialSeoTitle: string | null;
  initialSeoDescription: string | null;
  rawConfig: {
    config: unknown;
    displaySettings: unknown;
    scheduleSettings: unknown;
    eligibility: unknown;
    inventoryRules: unknown;
  };
  busy: boolean;
  /** SEO save fires through the page-level PUT handler. */
  onSave: (
    patch: { seoTitle: string | null; seoDescription: string | null },
  ) => Promise<void>;
  /** Duplicate fires POST /:id/duplicate and navigates to the new bundle. */
  onDuplicate: () => Promise<void>;
  /** Delete fires DELETE /:id and navigates back to /. */
  onDelete: () => Promise<void>;
}

// ---------------- Search engine listing ----------------

interface SeoCardProps {
  initialTitle: string | null;
  initialDescription: string | null;
  busy: boolean;
  onSave: AdvancedTabProps["onSave"];
}

function SeoCard({
  initialTitle,
  initialDescription,
  busy,
  onSave,
}: SeoCardProps): JSX.Element {
  const [title, setTitle] = useState<string>(initialTitle ?? "");
  const [description, setDescription] = useState<string>(
    initialDescription ?? "",
  );

  const dirty =
    title !== (initialTitle ?? "") ||
    description !== (initialDescription ?? "");
  const overTitle = title.length > SEO_TITLE_MAX;
  const overDesc = description.length > SEO_DESCRIPTION_MAX;

  return (
    <Card>
      <BlockStack gap="300">
        <Text as="h2" variant="headingMd">
          Search engine listing
        </Text>
        <Text as="p" tone="subdued">
          Override the title and description that search engines and
          social-share previews show for this bundle. Leave blank to
          fall back to the bundle's title and description.
        </Text>
        <TextField
          label="SEO title"
          value={title}
          onChange={setTitle}
          autoComplete="off"
          maxLength={SEO_TITLE_MAX + 20}
          helpText={`${title.length} / ${SEO_TITLE_MAX} characters.`}
          error={overTitle ? `Max ${SEO_TITLE_MAX} characters.` : undefined}
        />
        <TextField
          label="SEO description"
          value={description}
          onChange={setDescription}
          autoComplete="off"
          multiline={3}
          maxLength={SEO_DESCRIPTION_MAX + 50}
          helpText={`${description.length} / ${SEO_DESCRIPTION_MAX} characters.`}
          error={
            overDesc ? `Max ${SEO_DESCRIPTION_MAX} characters.` : undefined
          }
        />
        <InlineStack align="end">
          <Button
            variant="primary"
            onClick={() =>
              onSave({
                seoTitle: title.trim().length === 0 ? null : title,
                seoDescription:
                  description.trim().length === 0 ? null : description,
              })
            }
            loading={busy}
            disabled={busy || !dirty || overTitle || overDesc}
          >
            Save SEO
          </Button>
        </InlineStack>
      </BlockStack>
    </Card>
  );
}

// ---------------- Raw configuration ----------------

interface RawCardProps {
  blob: AdvancedTabProps["rawConfig"];
}

function pretty(v: unknown): string {
  try {
    return JSON.stringify(v ?? {}, null, 2);
  } catch {
    return "(unable to render)";
  }
}

function RawConfigCard({ blob }: RawCardProps): JSX.Element {
  const [open, setOpen] = useState(false);
  return (
    <Card>
      <BlockStack gap="300">
        <InlineStack align="space-between" blockAlign="center">
          <Text as="h2" variant="headingMd">
            Raw configuration
          </Text>
          <Button onClick={() => setOpen((v) => !v)} variant="tertiary">
            {open ? "Hide" : "Show"}
          </Button>
        </InlineStack>
        <Text as="p" tone="subdued">
          Read-only view of the per-bundle JSON columns. Useful when
          debugging a misbehaving theme block or attaching state to a
          support ticket.
        </Text>
        <Collapsible
          id="advanced-raw-config"
          open={open}
          transition={{ duration: "150ms", timingFunction: "ease-in-out" }}
        >
          <BlockStack gap="300">
            {(
              [
                ["config", blob.config],
                ["displaySettings", blob.displaySettings],
                ["scheduleSettings", blob.scheduleSettings],
                ["eligibility", blob.eligibility],
                ["inventoryRules", blob.inventoryRules],
              ] as const
            ).map(([key, value]) => (
              <BlockStack gap="100" key={key}>
                <Text as="p" variant="bodySm" fontWeight="semibold">
                  {key}
                </Text>
                <pre
                  style={{
                    background: "var(--p-color-bg-surface-secondary)",
                    padding: "12px",
                    borderRadius: "8px",
                    fontFamily:
                      "SFMono-Regular, ui-monospace, Menlo, monospace",
                    fontSize: "12px",
                    overflowX: "auto",
                    margin: 0,
                  }}
                >
                  {pretty(value)}
                </pre>
              </BlockStack>
            ))}
          </BlockStack>
        </Collapsible>
      </BlockStack>
    </Card>
  );
}

// ---------------- Danger zone ----------------

interface DangerCardProps {
  busy: boolean;
  onDuplicate: AdvancedTabProps["onDuplicate"];
  onDelete: AdvancedTabProps["onDelete"];
}

function DangerCard({
  busy,
  onDuplicate,
  onDelete,
}: DangerCardProps): JSX.Element {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const canDelete = confirmText.trim().toUpperCase() === "DELETE";

  return (
    <Card>
      <BlockStack gap="300">
        <Text as="h2" variant="headingMd">
          Danger zone
        </Text>
        <Banner tone="warning">
          <p>
            Duplicate copies the bundle's items, pricing rules, and
            settings into a new draft. Delete soft-archives the bundle
            so it disappears from the storefront and the list — orders
            already containing this bundle keep their history.
          </p>
        </Banner>
        <InlineStack gap="300">
          <Button onClick={onDuplicate} loading={busy} disabled={busy}>
            Duplicate this bundle
          </Button>
          <Button
            tone="critical"
            variant="primary"
            onClick={() => setConfirmOpen(true)}
            disabled={busy}
          >
            Delete this bundle
          </Button>
        </InlineStack>
      </BlockStack>
      <Modal
        open={confirmOpen}
        onClose={() => {
          setConfirmOpen(false);
          setConfirmText("");
        }}
        title="Delete this bundle?"
        primaryAction={{
          content: "Delete",
          destructive: true,
          loading: busy,
          disabled: !canDelete || busy,
          onAction: async () => {
            await onDelete();
            setConfirmOpen(false);
            setConfirmText("");
          },
        }}
        secondaryActions={[
          {
            content: "Cancel",
            onAction: () => {
              setConfirmOpen(false);
              setConfirmText("");
            },
          },
        ]}
      >
        <Modal.Section>
          <BlockStack gap="300">
            <Text as="p">
              The bundle is hidden from the storefront and the list,
              but past orders that include it keep their history. To
              confirm, type <strong>DELETE</strong> below.
            </Text>
            <TextField
              label="Type DELETE to confirm"
              value={confirmText}
              onChange={setConfirmText}
              autoComplete="off"
            />
          </BlockStack>
        </Modal.Section>
      </Modal>
    </Card>
  );
}

// ---------------- Tab shell ----------------

export function AdvancedTab(props: AdvancedTabProps): JSX.Element {
  const {
    initialSeoTitle,
    initialSeoDescription,
    rawConfig,
    busy,
    onSave,
    onDuplicate,
    onDelete,
  } = props;
  return (
    <BlockStack gap="400">
      <SeoCard
        initialTitle={initialSeoTitle}
        initialDescription={initialSeoDescription}
        busy={busy}
        onSave={onSave}
      />
      <RawConfigCard blob={rawConfig} />
      <DangerCard busy={busy} onDuplicate={onDuplicate} onDelete={onDelete} />
    </BlockStack>
  );
}
