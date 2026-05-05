import { useEffect, useState } from "react";
import { Card, Page, Spinner, Text, Checkbox, Button } from "@shopify/polaris";

interface Settings {
  safetyLock?: boolean;
  notifications?: { email?: boolean; inApp?: boolean };
}

export function SettingsPage(): JSX.Element {
  const [state, setState] = useState<Settings | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/v1/settings")
      .then((r) =>
        r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`)),
      )
      .then(setState)
      .catch((e: Error) => setError(e.message));
  }, []);

  async function patch(next: Partial<Settings>): Promise<void> {
    setSaving(true);
    try {
      const res = await fetch("/api/v1/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(next),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const merged = (await res.json()) as Settings;
      setState(merged);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  if (error && !state) {
    return (
      <Page title="Settings">
        <Card>
          <Text as="p" tone="critical">
            {error}
          </Text>
        </Card>
      </Page>
    );
  }
  if (!state) {
    return (
      <Page title="Settings">
        <Card>
          <Spinner accessibilityLabel="Loading" />
        </Card>
      </Page>
    );
  }
  return (
    <Page title="Settings">
      <Card>
        <Text as="h2" variant="headingMd">
          Inventory
        </Text>
        <Checkbox
          label="Safety lock — require manual approval before pushing changes to Shopify"
          checked={state.safetyLock === true}
          onChange={(checked: boolean) => patch({ safetyLock: checked })}
          disabled={saving}
        />
      </Card>
      <Card>
        <Text as="h2" variant="headingMd">
          Notifications
        </Text>
        <Checkbox
          label="Email notifications"
          checked={state.notifications?.email !== false}
          onChange={(checked: boolean) =>
            patch({
              notifications: { ...state.notifications, email: checked },
            })
          }
          disabled={saving}
        />
        <Checkbox
          label="In-app notifications"
          checked={state.notifications?.inApp !== false}
          onChange={(checked: boolean) =>
            patch({
              notifications: { ...state.notifications, inApp: checked },
            })
          }
          disabled={saving}
        />
      </Card>
      {error ? (
        <Card>
          <Text as="p" tone="critical">
            Save error: {error}
          </Text>
          <Button onClick={() => setError(null)} variant="tertiary">
            Dismiss
          </Button>
        </Card>
      ) : null}
    </Page>
  );
}
