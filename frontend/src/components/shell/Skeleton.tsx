/**
 * Inline skeleton primitives (M-182).
 *
 * `PageLoading` already covers full-page loaders. This file
 * adds tiny inline-loader helpers for the "Loading articles…"
 * text scattered across components — one shared shape lets
 * us upgrade the visual treatment in one place later (e.g.
 * swap the text for a spinner) without rewriting every
 * call site.
 */
import { Card, SkeletonBodyText, Spinner, Text } from "@shopify/polaris";

interface InlineLoaderProps {
  /** Human-readable label, e.g. "Loading articles…". */
  text?: string;
}

export function InlineLoader({ text }: InlineLoaderProps): JSX.Element {
  return (
    <Card>
      <Spinner accessibilityLabel={text ?? "Loading"} size="small" />
      {text && (
        <Text as="p" tone="subdued">
          {text}
        </Text>
      )}
    </Card>
  );
}

interface SkeletonRowsProps {
  /** Number of placeholder rows. Defaults to 3. */
  rows?: number;
}

export function SkeletonRows({ rows = 3 }: SkeletonRowsProps): JSX.Element {
  return (
    <Card>
      <SkeletonBodyText lines={rows} />
    </Card>
  );
}
