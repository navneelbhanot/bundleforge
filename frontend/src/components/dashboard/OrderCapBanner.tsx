/**
 * OrderCapBanner (M-201).
 *
 * Renders a Polaris banner above the Dashboard widgets when a
 * Starter shop is approaching or has reached its monthly bundle
 * order cap. The banner's primary action navigates the merchant
 * to Settings → Billing where the existing BillingPanel
 * (M-167) handles the actual upgrade flow.
 *
 * Three states:
 *  - approaching (count/cap >= 0.8, not yet over)  → warning
 *  - over       (count >= cap)                     → critical
 *  - otherwise (paid plan / under threshold / null) → renders nothing
 *
 * Pure presentational — receives the cap shape as a prop so the
 * Dashboard can keep all fetching at the page level.
 */
import { Banner, Text } from "@shopify/polaris";

export interface OrderCapBannerStatus {
  /** Resolved plan name (only "starter" carries a finite cap today). */
  plan: string;
  /** Plan cap; null = unlimited (paid plans). */
  cap: number | null;
  /** Distinct Shopify orders observed this calendar month (UTC). */
  count: number;
  /** True when the shop has hit/exceeded its cap. */
  over: boolean;
  /** True when count/cap >= 0.8 and not yet over. Server-derived. */
  approaching: boolean;
}

export interface OrderCapBannerProps {
  status: OrderCapBannerStatus | null;
  /**
   * Called when the merchant clicks the upgrade CTA. Default
   * implementation navigates to Settings → Billing tab via
   * `window.location.href`. Tests pass a stub.
   */
  onUpgrade?: () => void;
}

function defaultUpgrade(): void {
  // Settings page reads the hash on mount and switches to Billing.
  if (typeof window !== "undefined") {
    window.location.href = "/settings#billing";
  }
}

export function OrderCapBanner({
  status,
  onUpgrade = defaultUpgrade,
}: OrderCapBannerProps): JSX.Element | null {
  if (!status) return null;
  if (status.cap === null) return null;
  if (!status.over && !status.approaching) return null;

  const upgradeAction = {
    content: "Upgrade to Growth",
    onAction: onUpgrade,
  };

  if (status.over) {
    return (
      <Banner
        tone="critical"
        title={`You've reached your Starter monthly order limit (${status.cap}).`}
        action={upgradeAction}
      >
        <Text as="p">
          New bundle checkouts are blocked until next month or until you
          upgrade. Growth gives you unlimited orders for $12/month.
        </Text>
      </Banner>
    );
  }

  // approaching
  return (
    <Banner
      tone="warning"
      title={`You've used ${status.count} of ${status.cap} monthly bundle orders on Starter.`}
      action={upgradeAction}
    >
      <Text as="p">
        Once you hit {status.cap}, new bundle checkouts will be blocked until
        next month. Growth gives you unlimited orders for $12/month.
      </Text>
    </Banner>
  );
}
