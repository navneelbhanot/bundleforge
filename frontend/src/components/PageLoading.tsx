/**
 * Page-level loading state.
 *
 * Replaces the prior `<Page><Card><Spinner /></Card></Page>` pattern,
 * which rendered a small circle in the corner of a small card and
 * gave merchants no indication of what was about to appear.
 *
 * SkeletonPage mirrors a real Polaris page shell (back action, title,
 * primary action button on the right) so the chrome doesn't shift on
 * load. Inside, three shape variants:
 *
 *   - "list"   — one card filled with stacked body-text rows that
 *                approximate a populated table.
 *   - "detail" — main column with two stacked cards, sidebar with one.
 *   - "stats"  — a strip of stat cards above a body card, mirroring
 *                pages that show metrics + activity.
 */
import {
  Card,
  BlockStack,
  Grid,
  Layout,
  SkeletonBodyText,
  SkeletonDisplayText,
  SkeletonPage,
} from "@shopify/polaris";

export interface PageLoadingProps {
  title?: string;
  variant?: "list" | "detail" | "stats";
  /** Show a primary action skeleton on the page chrome. Default: true. */
  primaryAction?: boolean;
}

function StatCardSkeleton(): JSX.Element {
  return (
    <Card>
      <BlockStack gap="200">
        <SkeletonBodyText lines={1} />
        <SkeletonDisplayText size="medium" />
      </BlockStack>
    </Card>
  );
}

export function PageLoading({
  title,
  variant = "list",
  primaryAction = true,
}: PageLoadingProps): JSX.Element {
  if (variant === "detail") {
    return (
      <SkeletonPage title={title} primaryAction={primaryAction} backAction>
        <Layout>
          <Layout.Section>
            <BlockStack gap="400">
              <Card>
                <BlockStack gap="300">
                  <SkeletonDisplayText size="small" />
                  <SkeletonBodyText lines={4} />
                </BlockStack>
              </Card>
              <Card>
                <BlockStack gap="300">
                  <SkeletonDisplayText size="small" />
                  <SkeletonBodyText lines={3} />
                </BlockStack>
              </Card>
            </BlockStack>
          </Layout.Section>
          <Layout.Section variant="oneThird">
            <Card>
              <BlockStack gap="300">
                <SkeletonDisplayText size="small" />
                <SkeletonBodyText lines={5} />
              </BlockStack>
            </Card>
          </Layout.Section>
        </Layout>
      </SkeletonPage>
    );
  }

  if (variant === "stats") {
    return (
      <SkeletonPage title={title} primaryAction={primaryAction}>
        <BlockStack gap="400">
          <Grid>
            <Grid.Cell columnSpan={{ xs: 6, sm: 3, md: 3, lg: 3, xl: 3 }}>
              <StatCardSkeleton />
            </Grid.Cell>
            <Grid.Cell columnSpan={{ xs: 6, sm: 3, md: 3, lg: 3, xl: 3 }}>
              <StatCardSkeleton />
            </Grid.Cell>
            <Grid.Cell columnSpan={{ xs: 6, sm: 3, md: 3, lg: 3, xl: 3 }}>
              <StatCardSkeleton />
            </Grid.Cell>
            <Grid.Cell columnSpan={{ xs: 6, sm: 3, md: 3, lg: 3, xl: 3 }}>
              <StatCardSkeleton />
            </Grid.Cell>
          </Grid>
          <Card>
            <BlockStack gap="300">
              <SkeletonDisplayText size="small" />
              <SkeletonBodyText lines={6} />
            </BlockStack>
          </Card>
        </BlockStack>
      </SkeletonPage>
    );
  }

  // list — default
  return (
    <SkeletonPage title={title} primaryAction={primaryAction}>
      <Card>
        <BlockStack gap="400">
          <SkeletonDisplayText size="small" />
          <SkeletonBodyText lines={3} />
          <SkeletonBodyText lines={3} />
          <SkeletonBodyText lines={3} />
        </BlockStack>
      </Card>
    </SkeletonPage>
  );
}
