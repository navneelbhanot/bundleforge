import { useState } from "react";
import {
  Card,
  Page,
  Text,
  TextField,
  Button,
  Badge,
  Layout,
} from "@shopify/polaris";

interface SignificanceResult {
  p: number;
  z: number;
  significant: boolean;
  winner: "A" | "B" | null;
  rateA: number;
  rateB: number;
}

export function AbTestsPage(): JSX.Element {
  const [aConv, setAConv] = useState("50");
  const [aExp, setAExp] = useState("1000");
  const [bConv, setBConv] = useState("100");
  const [bExp, setBExp] = useState("1000");
  const [result, setResult] = useState<SignificanceResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function compute(): Promise<void> {
    setError(null);
    try {
      const res = await fetch("/api/v1/analytics/ab-tests/significance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          a: { conversions: Number(aConv), exposures: Number(aExp) },
          b: { conversions: Number(bConv), exposures: Number(bExp) },
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setResult(await res.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <Page title="A/B tests">
      <Layout>
        <Layout.Section>
          <Card>
            <Text as="h2" variant="headingMd">
              Significance calculator
            </Text>
            <TextField
              label="Variant A conversions"
              type="number"
              value={aConv}
              onChange={setAConv}
              autoComplete="off"
            />
            <TextField
              label="Variant A exposures"
              type="number"
              value={aExp}
              onChange={setAExp}
              autoComplete="off"
            />
            <TextField
              label="Variant B conversions"
              type="number"
              value={bConv}
              onChange={setBConv}
              autoComplete="off"
            />
            <TextField
              label="Variant B exposures"
              type="number"
              value={bExp}
              onChange={setBExp}
              autoComplete="off"
            />
            <Button onClick={compute} variant="primary">
              Compute
            </Button>
          </Card>
        </Layout.Section>
        {error ? (
          <Layout.Section>
            <Card>
              <Text as="p" tone="critical">
                {error}
              </Text>
            </Card>
          </Layout.Section>
        ) : null}
        {result ? (
          <Layout.Section>
            <Card>
              <Text as="h3" variant="headingMd">
                Result
              </Text>
              <Text as="p">
                Rate A: {(result.rateA * 100).toFixed(2)}% — Rate B:{" "}
                {(result.rateB * 100).toFixed(2)}%
              </Text>
              <Text as="p">
                z = {result.z.toFixed(3)}, p = {result.p.toFixed(4)}
              </Text>
              {result.significant ? (
                <Badge tone="success">{`Winner: ${result.winner}`}</Badge>
              ) : (
                <Badge tone="info">Not significant</Badge>
              )}
            </Card>
          </Layout.Section>
        ) : null}
      </Layout>
    </Page>
  );
}
