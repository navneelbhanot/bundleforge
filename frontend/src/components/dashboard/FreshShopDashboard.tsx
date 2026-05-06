/**
 * Fresh-shop welcome surface (extracted from BundlesListPage in
 * M-184 so DashboardPage and BundlesListPage can share it).
 *
 * Rendered when the shop has zero bundles and the merchant
 * hasn't dismissed the welcome.
 */
import {
  BlockStack,
  Box,
  Button,
  Card,
  Grid,
  InlineStack,
  Text,
} from "@shopify/polaris";

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

export interface FreshShopDashboardProps {
  onCreate: () => void;
  onTour: () => void;
  onBrowseTemplates: () => void;
  onDismiss: () => void;
}

export function FreshShopDashboard({
  onCreate,
  onTour,
  onBrowseTemplates,
  onDismiss,
}: FreshShopDashboardProps): JSX.Element {
  return (
    <BlockStack gap="500">
      <Card>
        <Box
          padding="600"
          background="bg-surface-secondary"
          borderRadius="300"
        >
          <BlockStack gap="300">
            <Text as="h1" variant="heading2xl">
              No bundles yet — let&apos;s fix that.
            </Text>
            <Text as="p" tone="subdued">
              BundleForge runs the same pricing engine on the cart, the
              checkout, and the audit log so cents agree everywhere.
              Components decrement atomically. Every adjustment is
              recorded and immutable. You publish, customers buy,
              accounting ties out — that&apos;s the whole pitch.
            </Text>
            <InlineStack gap="200">
              <Button variant="primary" onClick={onCreate}>
                Create your first bundle
              </Button>
              <Button onClick={onBrowseTemplates}>Browse templates</Button>
              <Button onClick={onTour}>Take the 30-second tour</Button>
              <Button variant="tertiary" onClick={onDismiss}>
                I&apos;ll explore on my own
              </Button>
            </InlineStack>
          </BlockStack>
        </Box>
      </Card>

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

      <Card>
        <BlockStack gap="200">
          <Text as="h2" variant="headingMd">
            When you&apos;re ready
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
