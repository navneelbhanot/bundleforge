/**
 * Integrations tab content (M-166).
 *
 * Renders one Card per known integration, each with a status Badge
 * and a Configure button that opens a Polaris Modal. The modal has
 * one masked TextField per credential key the adapter expects, plus
 * "Test connection", "Save", and "Disconnect" actions.
 *
 * Credential values are NEVER returned by the API — the GET only
 * lists `credentialKeys`. Existing fields are pre-populated with a
 * "•••• <last 4 of name>" placeholder so the merchant knows which
 * ones are persisted; submitting an empty value means
 * "leave unchanged."
 */
import { useEffect, useState } from "react";
import {
  Badge,
  BlockStack,
  Banner,
  Box,
  Button,
  ButtonGroup,
  Card,
  InlineStack,
  Modal,
  Spinner,
  Text,
  TextField,
} from "@shopify/polaris";

interface IntegrationViewModel {
  type: string;
  label: string;
  kind: "push" | "feed";
  expectedCredKeys: string[];
  status: "active" | "inactive" | "error";
  lastSyncedAt: string | null;
  errorMessage: string | null;
  credentialKeys: string[];
  settings: Record<string, unknown>;
}

interface PingResult {
  ok: boolean;
  message?: string;
}

function statusTone(s: IntegrationViewModel["status"]): "success" | "info" | "critical" {
  if (s === "active") return "success";
  if (s === "error") return "critical";
  return "info";
}

function statusLabel(s: IntegrationViewModel["status"]): string {
  if (s === "active") return "Connected";
  if (s === "error") return "Error";
  return "Not connected";
}

interface ConfigureModalProps {
  vm: IntegrationViewModel;
  open: boolean;
  onClose: () => void;
  onSaved: (next: IntegrationViewModel) => void;
}

function ConfigureModal({
  vm,
  open,
  onClose,
  onSaved,
}: ConfigureModalProps): JSX.Element {
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(vm.expectedCredKeys.map((k) => [k, ""])),
  );
  const [busy, setBusy] = useState(false);
  const [pingResult, setPingResult] = useState<PingResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setValues(
        Object.fromEntries(vm.expectedCredKeys.map((k) => [k, ""])),
      );
      setPingResult(null);
      setError(null);
    }
  }, [open, vm.expectedCredKeys]);

  function placeholderFor(key: string): string {
    return vm.credentialKeys.includes(key)
      ? "•••••• (saved — leave blank to keep)"
      : "";
  }

  async function test(): Promise<void> {
    setBusy(true);
    setError(null);
    setPingResult(null);
    try {
      const res = await fetch(`/api/v1/integrations/${vm.type}/test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ credentials: nonEmptyCredentials(values) }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setPingResult((await res.json()) as PingResult);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function save(): Promise<void> {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/integrations/${vm.type}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ credentials: values }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const next = (await res.json()) as IntegrationViewModel;
      onSaved(next);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function disconnect(): Promise<void> {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/integrations/${vm.type}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      onSaved({
        ...vm,
        status: "inactive",
        credentialKeys: [],
      });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Configure ${vm.label}`}
      primaryAction={{
        content: "Save",
        onAction: save,
        loading: busy,
        disabled: busy,
      }}
      secondaryActions={[
        {
          content: "Test connection",
          onAction: test,
          loading: busy,
          disabled: busy,
        },
        ...(vm.status === "active"
          ? [
              {
                content: "Disconnect",
                onAction: disconnect,
                destructive: true,
                disabled: busy,
              },
            ]
          : []),
      ]}
    >
      <Modal.Section>
        <BlockStack gap="300">
          {error && (
            <Banner tone="critical" title="Couldn't complete request">
              {error}
            </Banner>
          )}
          {pingResult && pingResult.ok && (
            <Banner tone="success" title="Connection successful" />
          )}
          {pingResult && !pingResult.ok && (
            <Banner tone="critical" title="Connection failed">
              {pingResult.message ?? "Unknown error"}
            </Banner>
          )}
          {vm.expectedCredKeys.length === 0 ? (
            <Text as="p">
              {vm.label} doesn&apos;t need credentials.
            </Text>
          ) : (
            vm.expectedCredKeys.map((k) => (
              <TextField
                key={k}
                label={k}
                type="password"
                value={values[k] ?? ""}
                onChange={(v) => setValues({ ...values, [k]: v })}
                autoComplete="off"
                placeholder={placeholderFor(k)}
                helpText={
                  vm.credentialKeys.includes(k)
                    ? "Saved — leave blank to keep the existing value."
                    : undefined
                }
              />
            ))
          )}
        </BlockStack>
      </Modal.Section>
    </Modal>
  );
}

function nonEmptyCredentials(
  values: Record<string, string>,
): Record<string, string> {
  return Object.fromEntries(
    Object.entries(values).filter(([, v]) => v.length > 0),
  );
}

interface IntegrationRowProps {
  vm: IntegrationViewModel;
  shopifyDomain: string | null;
  onChanged: (next: IntegrationViewModel) => void;
}

function feedUrlFor(type: string, shopifyDomain: string | null): string | null {
  if (type !== "google_merchant" || !shopifyDomain) return null;
  if (typeof window === "undefined") {
    return `/api/feeds/google-merchant?shop=${encodeURIComponent(shopifyDomain)}`;
  }
  return `${window.location.origin}/api/feeds/google-merchant?shop=${encodeURIComponent(shopifyDomain)}`;
}

function FeedUrlSurface({ url }: { url: string }): JSX.Element {
  const [copied, setCopied] = useState(false);
  async function copy(): Promise<void> {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
      } else if (typeof window !== "undefined") {
        // Fallback for jsdom / older browsers — select and copy
        // through a temporary textarea.
        const ta = document.createElement("textarea");
        ta.value = url;
        document.body.appendChild(ta);
        ta.select();
        try {
          document.execCommand?.("copy");
        } catch {
          // ignore
        }
        document.body.removeChild(ta);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore — UI just won't flash "copied"
    }
  }
  return (
    <BlockStack gap="200">
      <TextField
        label="Feed URL"
        value={url}
        autoComplete="off"
        readOnly
        labelHidden
      />
      <InlineStack gap="200">
        <Button onClick={copy}>{copied ? "Copied" : "Copy URL"}</Button>
      </InlineStack>
    </BlockStack>
  );
}

function IntegrationRow({
  vm,
  shopifyDomain,
  onChanged,
}: IntegrationRowProps): JSX.Element {
  const [open, setOpen] = useState(false);
  const feedUrl = feedUrlFor(vm.type, shopifyDomain);
  return (
    <Card>
      <BlockStack gap="200">
        <InlineStack align="space-between" blockAlign="center" wrap>
          <BlockStack gap="100">
            <InlineStack gap="200" blockAlign="center">
              <Text as="h3" variant="headingSm">
                {vm.label}
              </Text>
              <Badge tone={statusTone(vm.status)}>{statusLabel(vm.status)}</Badge>
            </InlineStack>
            <Text as="p" tone="subdued" variant="bodySm">
              {vm.kind === "feed"
                ? "Feed-based integration. Paste the URL on the right into Google Merchant Center."
                : vm.expectedCredKeys.length === 0
                  ? "No credentials required."
                  : `Needs: ${vm.expectedCredKeys.join(", ")}`}
            </Text>
            {vm.errorMessage && (
              <Text as="p" tone="critical" variant="bodySm">
                {vm.errorMessage}
              </Text>
            )}
          </BlockStack>
          {vm.kind === "feed" ? (
            feedUrl ? (
              <Box minWidth="320px">
                <FeedUrlSurface url={feedUrl} />
              </Box>
            ) : (
              <Text as="p" tone="subdued">
                Feed URL needs your Shopify domain.
              </Text>
            )
          ) : (
            <Button onClick={() => setOpen(true)}>Configure</Button>
          )}
        </InlineStack>
      </BlockStack>
      {vm.kind !== "feed" && (
        <ConfigureModal
          vm={vm}
          open={open}
          onClose={() => setOpen(false)}
          onSaved={onChanged}
        />
      )}
    </Card>
  );
}

interface IntegrationsTabProps {
  /** From settings.general.shopifyDomain — used to build the
   * Google Merchant feed URL. Optional in tests. */
  shopifyDomain?: string | null;
}

export function IntegrationsTab({ shopifyDomain = null }: IntegrationsTabProps = {}): JSX.Element {
  const [rows, setRows] = useState<IntegrationViewModel[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/v1/integrations")
      .then((r) =>
        r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`)),
      )
      .then((body: IntegrationViewModel[]) => setRows(body))
      .catch((e: Error) => setError(e.message));
  }, []);

  if (error) {
    return (
      <Card>
        <Text as="p" tone="critical">
          Failed to load integrations: {error}
        </Text>
      </Card>
    );
  }

  if (rows === null) {
    return (
      <Card>
        <InlineStack gap="200" align="center" blockAlign="center">
          <Spinner accessibilityLabel="Loading integrations" size="small" />
          <Text as="p">Loading integrations…</Text>
        </InlineStack>
      </Card>
    );
  }

  function updateOne(next: IntegrationViewModel): void {
    setRows((prev) =>
      (prev ?? []).map((r) => (r.type === next.type ? next : r)),
    );
  }

  return (
    <BlockStack gap="300">
      <Box paddingBlockEnd="200">
        <Text as="p" tone="subdued">
          Connect ShipStation, Recharge, and others to push BundleForge
          orders to your existing stack. Credentials are AES-256
          encrypted at rest. The Test connection button hits each
          provider&apos;s health endpoint without persisting.
        </Text>
      </Box>
      <ButtonGroup>
        {/* Reserved for a future "Add custom integration" CTA. */}
      </ButtonGroup>
      {rows.map((vm) => (
        <IntegrationRow
          key={vm.type}
          vm={vm}
          shopifyDomain={shopifyDomain}
          onChanged={updateOne}
        />
      ))}
    </BlockStack>
  );
}
