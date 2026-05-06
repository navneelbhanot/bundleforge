/**
 * Shared empty-state wrapper (M-183).
 *
 * Replaces the `<Card><EmptyState image="" .../></Card>`
 * pattern scattered across list pages with a one-call
 * primitive that pulls a named SVG illustration from the
 * registry. Falls back gracefully to no image when
 * `illustration` is omitted, so existing image-less
 * surfaces can adopt the wrapper without acquiring an
 * accidental graphic.
 */
import { Card, EmptyState } from "@shopify/polaris";
import {
  getIllustration,
  type IllustrationName,
} from "./illustrations";

type ActionShape = {
  content: string;
  url?: string;
  onAction?: () => void;
};

export interface EmptyStateCardProps {
  illustration?: IllustrationName;
  heading: string;
  body?: string;
  primaryAction?: ActionShape;
  secondaryAction?: ActionShape;
  children?: React.ReactNode;
}

export function EmptyStateCard(props: EmptyStateCardProps): JSX.Element {
  const {
    illustration,
    heading,
    body,
    primaryAction,
    secondaryAction,
    children,
  } = props;
  return (
    <Card>
      <EmptyState
        heading={heading}
        image={getIllustration(illustration)}
        action={primaryAction}
        secondaryAction={secondaryAction}
      >
        {body && <p>{body}</p>}
        {children}
      </EmptyState>
    </Card>
  );
}
