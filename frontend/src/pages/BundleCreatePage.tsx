/**
 * Minimal "create bundle" page.
 *
 * Server-side `create()` only requires `title` + `type`; items and
 * pricing rules default to empty arrays so the new bundle can be
 * fleshed out from the detail page afterwards.
 */
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Banner,
  Button,
  Card,
  FormLayout,
  Page,
  Select,
  TextField,
} from "@shopify/polaris";

const BUNDLE_TYPES: Array<{ label: string; value: string }> = [
  { label: "Fixed", value: "fixed" },
  { label: "Mix & match", value: "mix_match" },
  { label: "BOGO", value: "bogo" },
  { label: "Buy X get Y", value: "bxgy" },
  { label: "Volume", value: "volume" },
  { label: "Build a box", value: "build_box" },
  { label: "Multipack", value: "multipack" },
  { label: "Gift", value: "gift" },
  { label: "Mystery", value: "mystery" },
  { label: "Sample", value: "sample" },
  { label: "Subscription", value: "subscription" },
  { label: "Wholesale", value: "wholesale" },
  { label: "Custom", value: "custom" },
];

export function BundleCreatePage(): JSX.Element {
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const [type, setType] = useState("fixed");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSave = async (): Promise<void> => {
    setError(null);
    if (!title.trim()) {
      setError("Title is required.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/v1/bundles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, type, items: [], pricingRules: [] }),
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
  };

  return (
    <Page
      title="Create bundle"
      backAction={{ content: "Bundles", url: "/" }}
      primaryAction={{
        content: "Save",
        onAction: onSave,
        loading: submitting,
        disabled: submitting,
      }}
    >
      <Card>
        <FormLayout>
          {error && (
            <Banner tone="critical" title="Could not create bundle">
              {error}
            </Banner>
          )}
          <TextField
            label="Title"
            value={title}
            onChange={setTitle}
            autoComplete="off"
            requiredIndicator
          />
          <Select
            label="Type"
            options={BUNDLE_TYPES}
            value={type}
            onChange={setType}
          />
        </FormLayout>
      </Card>
    </Page>
  );
}
