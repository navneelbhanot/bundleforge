/**
 * Bundles list page (M-097).
 *
 * Fetches /api/v1/bundles. When there are bundles, renders an
 * IndexTable with summary stat strip above. When there aren't, shows
 * a "welcome to BundleForge" landing that leans into our actual
 * technical differentiators (atomic inventory, pricing parity, audit
 * trail) rather than a generic onboarding checklist — and offers the
 * three-step OnboardingWizard for merchants who want a guided tour.
 */
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  BlockStack,
  Box,
  Button,
  Card,
  Grid,
  IndexTable,
  InlineStack,
  Page,
  Text,
  Badge,
} from "@shopify/polaris";

import { OnboardingWizard } from "../components/OnboardingWizard";
import { PageLoading } from "../components/PageLoading";

interface BundleRow {
  id: string;
  title: string;
  type: string;
  status: string;
  slug: string;
}

const ONBOARDING_DISMISSED_KEY = "bundleforge:onboarding-dismissed";

function readDismissed(): boolean {
  try {
    return window.localStorage.getItem(ONBOARDING_DISMISSED_KEY) === "1";
  } catch {
    return false;
  }
}

function writeDismissed(): void {
  try {
    window.localStorage.setItem(ONBOARDING_DISMISSED_KEY, "1");
  } catch {
    // private mode / disabled — silently fall through; the wizard will
    // re-appear on next load, which is acceptable.
  }
}

interface DifferentiatorProps {
  title: string;
  body: string;
  accent: string;
}

function Differentiator({ title, body, accent }: DifferentiatorProps): JSX.Element {
  return (
    <Card>
      <BlockStack gap="200">
        <InlineStack gap="200" blockAlign="center">
          <span
            aria-hidden
            style={{
              display: "inline-block",
              width: 8,
              height: 8,
              borderRadius: 999,
              background: accent,
            }}
          />
          <Text as="h3" variant="headingSm">
            {title}
          </Text>
        </InlineStack>
        <Text as="p" tone="subdued">
          {body}
        </Text>
      </BlockStack>
    </Card>
  );
}

interface StatCardProps {
  label: string;
  value: string | number;
  tone?: "default" | "success" | "info" | "warning";
}

function StatCard({ label, value, tone = "default" }: StatCardProps): JSX.Element {
  const accent =
    tone === "success"
      ? "#1f7a3f"
      : tone === "warning"
        ? "#a66200"
        : tone === "info"
          ? "#1f5fa6"
          : "#1e293b";
  return (
    <Card>
      <BlockStack gap="100">
        <Text as="p" tone="subdued" variant="bodySm">
          {label}
        </Text>
        <Text as="p" variant="heading2xl">
          <span style={{ color: accent }}>{value}</span>
        </Text>
      </BlockStack>
    </Card>
  );
}

function FreshShopDashboard({
  onCreate,
  onTour,
  onDismiss,
}: {
  onCreate: () => void;
  onTour: () => void;
  onDismiss: () => void;
}): JSX.Element {
  return (
    <BlockStack gap="500">
      {/* Hero — distinctive, not a Bundler clone. Confident, technical voice. */}
      <Card>
        <Box
          padding="600"
          background="bg-surface-secondary"
          borderRadius="300"
        >
          <BlockStack gap="300">
            <Text as="h1" variant="heading2xl">
              No bundles yet — let's fix that.
            </Text>
            <Text as="p" tone="subdued">
              BundleForge runs the same pricing engine on the cart, the
              checkout, and the audit log so cents agree everywhere.
              Components decrement atomically. Every adjustment is
              recorded and immutable. You publish, customers buy,
              accounting ties out — that's the whole pitch.
            </Text>
            <InlineStack gap="200">
              <Button variant="primary" onClick={onCreate}>
                Create your first bundle
              </Button>
              <Button onClick={onTour}>Take the 30-second tour</Button>
              <Button variant="tertiary" onClick={onDismiss}>
                I'll explore on my own
              </Button>
            </InlineStack>
          </BlockStack>
        </Box>
      </Card>

      {/* Three differentiators — these are real properties of the codebase,
          not marketing fluff. Each maps to a specific code path the merchant
          can verify. */}
      <Grid>
        <Grid.Cell columnSpan={{ xs: 6, sm: 6, md: 4, lg: 4, xl: 4 }}>
          <Differentiator
            accent="#1f7a3f"
            title="Atomic inventory"
            body="Each bundle order decrements every component SKU in a single Postgres transaction. Partial updates are impossible by construction."
          />
        </Grid.Cell>
        <Grid.Cell columnSpan={{ xs: 6, sm: 6, md: 4, lg: 4, xl: 4 }}>
          <Differentiator
            accent="#1f5fa6"
            title="Pricing parity"
            body="The same pure pricing function runs server-side, in the cart, and in Shopify's Cart Transform Function. A test enforces cents-exact agreement on every commit."
          />
        </Grid.Cell>
        <Grid.Cell columnSpan={{ xs: 6, sm: 6, md: 4, lg: 4, xl: 4 }}>
          <Differentiator
            accent="#a66200"
            title="Immutable audit log"
            body="Every inventory event writes to inventory_audit_log. The table has a database-level trigger that rejects UPDATE — your reconciliation history can't drift."
          />
        </Grid.Cell>
      </Grid>

      {/* Lightweight links — no aggressive checklist, no upsell card. */}
      <Card>
        <BlockStack gap="200">
          <Text as="h2" variant="headingMd">
            When you're ready
          </Text>
          <Text as="p" tone="subdued">
            BundleForge installs as a Theme App Extension on Online
            Store 2.0 themes. No Liquid edits. Five drop-in blocks
            (universal, mix-and-match, BOGO, build-a-box, variant
            selector) cover every bundle type.
          </Text>
        </BlockStack>
      </Card>
    </BlockStack>
  );
}

export function BundlesListPage(): JSX.Element {
  const navigate = useNavigate();
  const [rows, setRows] = useState<BundleRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showWizard, setShowWizard] = useState(false);
  const [wizardDismissed, setWizardDismissed] = useState(readDismissed);

  useEffect(() => {
    fetch("/api/v1/bundles")
      .then((r) =>
        r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`)),
      )
      .then((body: { data: BundleRow[] }) => setRows(body.data))
      .catch((e: Error) => setError(e.message));
  }, []);

  function handleDismiss(): void {
    writeDismissed();
    setWizardDismissed(true);
    setShowWizard(false);
  }

  function handleComplete(): void {
    handleDismiss();
    navigate("/bundles/new");
  }

  if (error) {
    return (
      <Page title="Bundles">
        <Card>
          <Text as="p" tone="critical">
            Failed to load: {error}
          </Text>
        </Card>
      </Page>
    );
  }
  if (rows === null) {
    return <PageLoading title="Bundles" variant="stats" />;
  }

  // Fresh shop and merchant clicked "Take the tour".
  if (showWizard) {
    return (
      <Page title="Bundles">
        <OnboardingWizard
          onComplete={handleComplete}
          onDismiss={() => setShowWizard(false)}
        />
      </Page>
    );
  }

  // Fresh shop: rich landing instead of a blank IndexTable. Reading
  // wizardDismissed lets us also show this layout post-dismiss without
  // re-prompting (still no bundles, but the welcome card stays as
  // context until they create one).
  if (rows.length === 0) {
    return (
      <Page title="Bundles">
        <FreshShopDashboard
          onCreate={() => navigate("/bundles/new")}
          onTour={() => setShowWizard(true)}
          onDismiss={handleDismiss}
        />
      </Page>
    );
  }

  // Has bundles: stats strip + table.
  const active = rows.filter((b) => b.status === "active").length;
  const draft = rows.filter((b) => b.status === "draft").length;
  const archived = rows.filter((b) => b.status === "archived").length;

  return (
    <Page
      title="Bundles"
      primaryAction={{ content: "Create bundle", url: "/bundles/new" }}
    >
      <BlockStack gap="500">
        <Grid>
          <Grid.Cell columnSpan={{ xs: 6, sm: 3, md: 3, lg: 3, xl: 3 }}>
            <StatCard label="Total" value={rows.length} />
          </Grid.Cell>
          <Grid.Cell columnSpan={{ xs: 6, sm: 3, md: 3, lg: 3, xl: 3 }}>
            <StatCard label="Active" value={active} tone="success" />
          </Grid.Cell>
          <Grid.Cell columnSpan={{ xs: 6, sm: 3, md: 3, lg: 3, xl: 3 }}>
            <StatCard label="Draft" value={draft} tone="info" />
          </Grid.Cell>
          <Grid.Cell columnSpan={{ xs: 6, sm: 3, md: 3, lg: 3, xl: 3 }}>
            <StatCard
              label="Archived"
              value={archived}
              tone={archived > 0 ? "warning" : "default"}
            />
          </Grid.Cell>
        </Grid>

        <Card>
          <IndexTable
            itemCount={rows.length}
            headings={[
              { title: "Title" },
              { title: "Type" },
              { title: "Status" },
              { title: "" },
            ]}
            selectable={false}
          >
            {rows.map((b, i) => (
              <IndexTable.Row
                id={b.id}
                key={b.id}
                position={i}
                onClick={() => navigate(`/bundles/${b.id}`)}
              >
                <IndexTable.Cell>
                  <Text as="span" fontWeight="semibold">
                    {b.title}
                  </Text>
                </IndexTable.Cell>
                <IndexTable.Cell>{b.type}</IndexTable.Cell>
                <IndexTable.Cell>
                  <Badge tone={b.status === "active" ? "success" : "info"}>
                    {b.status}
                  </Badge>
                </IndexTable.Cell>
                <IndexTable.Cell>
                  <Button
                    onClick={() => navigate(`/bundles/${b.id}`)}
                    variant="tertiary"
                  >
                    Edit
                  </Button>
                </IndexTable.Cell>
              </IndexTable.Row>
            ))}
          </IndexTable>
        </Card>
      </BlockStack>
    </Page>
  );
}
