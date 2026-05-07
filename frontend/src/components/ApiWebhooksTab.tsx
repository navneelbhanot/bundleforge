/**
 * API & webhooks tab content (M-168 + M-168b).
 *
 * Two cards: API tokens and Outbound webhooks. Both follow the
 * "show plaintext exactly once at create" pattern — the plaintext
 * is rendered in a one-shot Banner that the merchant must copy
 * before closing the modal.
 */
import { useEffect, useState } from "react";
import {
  Badge,
  Banner,
  BlockStack,
  Box,
  Button,
  Card,
  ChoiceList,
  IndexTable,
  InlineStack,
  Modal,
  Spinner,
  Text,
  TextField,
} from "@shopify/polaris";

interface ApiTokenView {
  id: string;
  label: string;
  prefix: string;
  lastUsedAt: string | null;
  createdAt: string;
  revokedAt: string | null;
}

interface ApiTokenCreated extends ApiTokenView {
  plaintext: string;
}

interface OutboundWebhookView {
  id: string;
  url: string;
  events: string[];
  lastFiredAt: string | null;
  failCount: number;
  createdAt: string;
  disabledAt: string | null;
  hasSecret: boolean;
}

interface OutboundWebhookCreated extends OutboundWebhookView {
  secretPlaintext: string;
}

const ALL_EVENTS = [
  { label: "Bundle published", value: "bundle.published" },
  { label: "Bundle archived", value: "bundle.archived" },
  { label: "Bundle low stock", value: "bundle.low_stock" },
  { label: "Order dispatched", value: "order.dispatched" },
];

function formatRelative(iso: string | null): string {
  if (!iso) return "Never";
  const d = new Date(iso);
  const now = Date.now();
  const diff = (now - d.getTime()) / 1000;
  if (diff < 60) return "Just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

// ---------------- Tokens ----------------

interface CreateTokenModalProps {
  open: boolean;
  onClose: () => void;
  onCreated: (token: ApiTokenCreated) => void;
}

function CreateTokenModal({
  open,
  onClose,
  onCreated,
}: CreateTokenModalProps): JSX.Element {
  const [label, setLabel] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<ApiTokenCreated | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open) {
      setLabel("");
      setError(null);
      setCreated(null);
      setCopied(false);
    }
  }, [open]);

  async function save(): Promise<void> {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/api-tokens", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = (await res.json()) as ApiTokenCreated;
      setCreated(body);
      onCreated(body);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function copy(): Promise<void> {
    if (!created) return;
    try {
      await navigator.clipboard.writeText(created.plaintext);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Create API token"
      primaryAction={
        created
          ? { content: "Close", onAction: onClose }
          : {
              content: "Create",
              onAction: save,
              loading: busy,
              disabled: busy || label.trim().length === 0,
            }
      }
      secondaryActions={
        created ? [] : [{ content: "Cancel", onAction: onClose }]
      }
    >
      <Modal.Section>
        <BlockStack gap="300">
          {error && (
            <Banner tone="critical" title="Couldn't create token">
              {error}
            </Banner>
          )}
          {!created && (
            <TextField
              label="Label"
              value={label}
              onChange={setLabel}
              autoComplete="off"
              placeholder="e.g. Hydrogen storefront"
              maxLength={120}
              showCharacterCount
            />
          )}
          {created && (
            <Banner tone="info" title="Copy this token now">
              <BlockStack gap="200">
                <Text as="p">
                  This is the only time the full token is shown. After
                  you close this dialog, only the prefix
                  <code> {created.prefix} </code> will be visible.
                </Text>
                <TextField
                  label="Token"
                  labelHidden
                  value={created.plaintext}
                  readOnly
                  autoComplete="off"
                  monospaced
                />
                <InlineStack gap="200">
                  <Button onClick={copy}>{copied ? "Copied" : "Copy"}</Button>
                </InlineStack>
              </BlockStack>
            </Banner>
          )}
        </BlockStack>
      </Modal.Section>
    </Modal>
  );
}

interface TokensCardProps {
  rows: ApiTokenView[];
  onCreated: (token: ApiTokenCreated) => void;
  onRevoked: (id: string) => void;
  busy: boolean;
}

function TokensCard({
  rows,
  onCreated,
  onRevoked,
  busy,
}: TokensCardProps): JSX.Element {
  const [open, setOpen] = useState(false);
  const [revoking, setRevoking] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function revoke(id: string): Promise<void> {
    setRevoking(id);
    setError(null);
    try {
      const res = await fetch(`/api/v1/api-tokens/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      onRevoked(id);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setRevoking(null);
    }
  }

  return (
    <Card>
      <BlockStack gap="300">
        <InlineStack align="space-between" blockAlign="center">
          <Text as="h2" variant="headingMd">
            API tokens
          </Text>
          <Button onClick={() => setOpen(true)} variant="primary">
            Create token
          </Button>
        </InlineStack>
        <Text as="p" tone="subdued">
          Bearer tokens for headless storefronts, agencies, and your own
          backend. Send as <code>Authorization: Bearer &lt;token&gt;</code>.
          Revoking is immediate. Re-issuing requires creating a new
          token — there&apos;s no rotation surface yet.
        </Text>
        {error && (
          <Banner tone="critical" title="Couldn't revoke" onDismiss={() => setError(null)}>
            {error}
          </Banner>
        )}
        <IndexTable
          itemCount={rows.length}
          headings={[
            { title: "Label" },
            { title: "Prefix" },
            { title: "Last used" },
            { title: "Status" },
            { title: "" },
          ]}
          selectable={false}
          emptyState={
            <Box padding="400">
              <Text as="p" tone="subdued">
                No tokens yet. Click <strong>Create token</strong> to make
                one.
              </Text>
            </Box>
          }
        >
          {rows.map((r, i) => (
            <IndexTable.Row id={r.id} key={r.id} position={i}>
              <IndexTable.Cell>
                <Text as="span" fontWeight="semibold">
                  {r.label}
                </Text>
              </IndexTable.Cell>
              <IndexTable.Cell>
                <code>{r.prefix}…</code>
              </IndexTable.Cell>
              <IndexTable.Cell>{formatRelative(r.lastUsedAt)}</IndexTable.Cell>
              <IndexTable.Cell>
                {r.revokedAt ? (
                  <Badge tone="critical">Revoked</Badge>
                ) : (
                  <Badge tone="success">Active</Badge>
                )}
              </IndexTable.Cell>
              <IndexTable.Cell>
                {!r.revokedAt && (
                  <Button
                    onClick={() => revoke(r.id)}
                    loading={revoking === r.id}
                    disabled={busy || revoking === r.id}
                    tone="critical"
                    variant="tertiary"
                  >
                    Revoke
                  </Button>
                )}
              </IndexTable.Cell>
            </IndexTable.Row>
          ))}
        </IndexTable>
      </BlockStack>
      <CreateTokenModal
        open={open}
        onClose={() => setOpen(false)}
        onCreated={onCreated}
      />
    </Card>
  );
}

// ---------------- Outbound webhooks ----------------

interface CreateWebhookModalProps {
  open: boolean;
  onClose: () => void;
  onCreated: (wh: OutboundWebhookCreated) => void;
}

function CreateWebhookModal({
  open,
  onClose,
  onCreated,
}: CreateWebhookModalProps): JSX.Element {
  const [url, setUrl] = useState("");
  const [events, setEvents] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<OutboundWebhookCreated | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open) {
      setUrl("");
      setEvents([]);
      setError(null);
      setCreated(null);
      setCopied(false);
    }
  }, [open]);

  const urlValid = /^https?:\/\//.test(url);

  async function save(): Promise<void> {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/outbound-webhooks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, events }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = (await res.json()) as OutboundWebhookCreated;
      setCreated(body);
      onCreated(body);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function copy(): Promise<void> {
    if (!created) return;
    try {
      await navigator.clipboard.writeText(created.secretPlaintext);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add outbound webhook"
      primaryAction={
        created
          ? { content: "Close", onAction: onClose }
          : {
              content: "Add",
              onAction: save,
              loading: busy,
              disabled: busy || !urlValid || events.length === 0,
            }
      }
      secondaryActions={
        created ? [] : [{ content: "Cancel", onAction: onClose }]
      }
    >
      <Modal.Section>
        <BlockStack gap="300">
          {error && (
            <Banner tone="critical" title="Couldn't add webhook">
              {error}
            </Banner>
          )}
          {!created && (
            <>
              <TextField
                label="URL"
                value={url}
                onChange={setUrl}
                autoComplete="off"
                placeholder="https://example.com/webhooks/mintbundle"
                error={url.length > 0 && !urlValid ? "Must be http(s)://" : undefined}
              />
              <ChoiceList
                title="Events"
                allowMultiple
                choices={ALL_EVENTS}
                selected={events}
                onChange={setEvents}
              />
            </>
          )}
          {created && (
            <Banner tone="info" title="Copy this HMAC secret now">
              <BlockStack gap="200">
                <Text as="p">
                  Sign incoming POSTs with this secret to verify they came
                  from MintBundle. This is the only time the secret is
                  shown.
                </Text>
                <TextField
                  label="HMAC secret"
                  labelHidden
                  value={created.secretPlaintext}
                  readOnly
                  autoComplete="off"
                  monospaced
                />
                <InlineStack gap="200">
                  <Button onClick={copy}>{copied ? "Copied" : "Copy"}</Button>
                </InlineStack>
              </BlockStack>
            </Banner>
          )}
        </BlockStack>
      </Modal.Section>
    </Modal>
  );
}

interface WebhooksCardProps {
  rows: OutboundWebhookView[];
  onCreated: (wh: OutboundWebhookCreated) => void;
  onDeleted: (id: string) => void;
  busy: boolean;
}

function WebhooksCard({
  rows,
  onCreated,
  onDeleted,
  busy,
}: WebhooksCardProps): JSX.Element {
  const [open, setOpen] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function remove(id: string): Promise<void> {
    setRemoving(id);
    setError(null);
    try {
      const res = await fetch(`/api/v1/outbound-webhooks/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      onDeleted(id);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setRemoving(null);
    }
  }

  return (
    <Card>
      <BlockStack gap="300">
        <InlineStack align="space-between" blockAlign="center">
          <Text as="h2" variant="headingMd">
            Outbound webhooks
          </Text>
          <Button onClick={() => setOpen(true)} variant="primary">
            Add webhook
          </Button>
        </InlineStack>
        <Text as="p" tone="subdued">
          We POST to the URLs below when a subscribed event fires. Sign
          incoming requests with the HMAC secret you copied at creation
          to verify they came from MintBundle.
        </Text>
        {error && (
          <Banner tone="critical" title="Couldn't delete" onDismiss={() => setError(null)}>
            {error}
          </Banner>
        )}
        <IndexTable
          itemCount={rows.length}
          headings={[
            { title: "URL" },
            { title: "Events" },
            { title: "Status" },
            { title: "Last fired" },
            { title: "" },
          ]}
          selectable={false}
          emptyState={
            <Box padding="400">
              <Text as="p" tone="subdued">
                No webhooks yet. Click <strong>Add webhook</strong> to
                subscribe.
              </Text>
            </Box>
          }
        >
          {rows.map((r, i) => (
            <IndexTable.Row id={r.id} key={r.id} position={i}>
              <IndexTable.Cell>
                <Text as="span" fontWeight="semibold">
                  {r.url}
                </Text>
              </IndexTable.Cell>
              <IndexTable.Cell>{r.events.join(", ")}</IndexTable.Cell>
              <IndexTable.Cell>
                {r.disabledAt ? (
                  <Badge tone="info">Disabled</Badge>
                ) : (
                  <Badge tone="success">Enabled</Badge>
                )}
              </IndexTable.Cell>
              <IndexTable.Cell>{formatRelative(r.lastFiredAt)}</IndexTable.Cell>
              <IndexTable.Cell>
                <Button
                  onClick={() => remove(r.id)}
                  loading={removing === r.id}
                  disabled={busy || removing === r.id}
                  tone="critical"
                  variant="tertiary"
                >
                  Delete
                </Button>
              </IndexTable.Cell>
            </IndexTable.Row>
          ))}
        </IndexTable>
      </BlockStack>
      <CreateWebhookModal
        open={open}
        onClose={() => setOpen(false)}
        onCreated={onCreated}
      />
    </Card>
  );
}

// ---------------- Tab shell ----------------

export function ApiWebhooksTab(): JSX.Element {
  const [tokens, setTokens] = useState<ApiTokenView[] | null>(null);
  const [webhooks, setWebhooks] = useState<OutboundWebhookView[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      fetch("/api/v1/api-tokens").then((r) =>
        r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`)),
      ),
      fetch("/api/v1/outbound-webhooks").then((r) =>
        r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`)),
      ),
    ])
      .then(([t, w]: [ApiTokenView[], OutboundWebhookView[]]) => {
        setTokens(t);
        setWebhooks(w);
      })
      .catch((e: Error) => setError(e.message));
  }, []);

  function onTokenCreated(t: ApiTokenCreated): void {
    setTokens((prev) => [t, ...(prev ?? [])]);
  }
  function onTokenRevoked(id: string): void {
    setTokens((prev) =>
      (prev ?? []).map((t) =>
        t.id === id ? { ...t, revokedAt: new Date().toISOString() } : t,
      ),
    );
  }
  function onWebhookCreated(w: OutboundWebhookCreated): void {
    setWebhooks((prev) => [w, ...(prev ?? [])]);
  }
  function onWebhookDeleted(id: string): void {
    setWebhooks((prev) => (prev ?? []).filter((w) => w.id !== id));
  }

  if (error) {
    return (
      <Card>
        <Text as="p" tone="critical">
          Failed to load: {error}
        </Text>
      </Card>
    );
  }

  if (tokens === null || webhooks === null) {
    return (
      <Card>
        <InlineStack gap="200" align="center" blockAlign="center">
          <Spinner accessibilityLabel="Loading" size="small" />
          <Text as="p">Loading…</Text>
        </InlineStack>
      </Card>
    );
  }

  return (
    <BlockStack gap="400">
      <TokensCard
        rows={tokens}
        onCreated={onTokenCreated}
        onRevoked={onTokenRevoked}
        busy={false}
      />
      <WebhooksCard
        rows={webhooks}
        onCreated={onWebhookCreated}
        onDeleted={onWebhookDeleted}
        busy={false}
      />
    </BlockStack>
  );
}
