/**
 * Integration adapter types (M-116).
 */

export type IntegrationType =
  | "shipstation"
  | "amazon"
  | "recharge"
  | "bold"
  | "klaviyo"
  | "google_merchant"
  | "custom_3pl";

export interface IntegrationCreds {
  [key: string]: unknown;
}

export interface PingResult {
  ok: boolean;
  message?: string;
}

export interface BundleOrderEvent {
  shopifyOrderGid: string;
  shopifyOrderNumber: string;
  bundleId: string;
  currency: string;
  bundlePrice: string;
  skuBreakdown: Array<{
    sku: string | null;
    shopifyProductGid: string;
    quantity: number;
    title: string | null;
  }>;
}

/** Optional fetch dependency injection for tests. */
export type FetchLike = (
  input: string,
  init?: { method?: string; headers?: Record<string, string>; body?: string },
) => Promise<{ ok: boolean; status: number; text(): Promise<string> }>;

export interface IntegrationAdapter {
  type: IntegrationType;
  ping(creds: IntegrationCreds, fetcher?: FetchLike): Promise<PingResult>;
  pushOrder?(args: {
    creds: IntegrationCreds;
    order: BundleOrderEvent;
    fetcher?: FetchLike;
  }): Promise<void>;
}
