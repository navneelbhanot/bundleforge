// =============================================================================
// BundleForge — Core Type Definitions
// =============================================================================

export type BundleType =
  | "fixed"
  | "mix_match"
  | "bogo"
  | "bxgy"
  | "volume"
  | "build_box"
  | "multipack"
  | "gift"
  | "mystery"
  | "sample"
  | "subscription"
  | "wholesale"
  | "custom";

export type BundleStatus = "draft" | "active" | "archived" | "deleted";

export type PricingRuleType =
  | "fixed"
  | "percentage"
  | "flat_discount"
  | "tiered"
  | "volume"
  | "bogo"
  | "custom";

export type OrderStatus = "pending" | "processed" | "fulfilled" | "cancelled" | "error";

export type InventoryAction = "adjust" | "set" | "reserve" | "release" | "sync" | "rollback";

export type InventoryChangeReason =
  | "order_placed"
  | "order_cancelled"
  | "manual_adjust"
  | "sync"
  | "bundle_created"
  | "safety_lock";

export type InventorySource = "webhook" | "admin" | "api" | "system" | "migration";

export type AnalyticsEventType = "view" | "add_to_cart" | "checkout_start" | "purchase" | "remove";

export type IntegrationType =
  | "shipstation"
  | "amazon"
  | "recharge"
  | "bold"
  | "klaviyo"
  | "google_merchant"
  | "custom_3pl";

export type PlanName = "starter" | "growth" | "pro" | "enterprise";

export type BillingInterval = "monthly" | "annual";

export type BillingStatus = "active" | "pending" | "cancelled" | "frozen" | "expired";

// ── API Request/Response Types ──

export interface PaginationParams {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

export type RecurringRuleType = "daily" | "weekly" | "monthly";

export interface RecurringRuleInput {
  type: RecurringRuleType | null;
  /** Weekly only — 0 = Sunday … 6 = Saturday. */
  daysOfWeek?: number[];
  /** Monthly only — 1..31. */
  dayOfMonth?: number;
  /** "HH:MM" 24h. */
  startTime?: string;
  endTime?: string;
}

export type ScheduleEndBehavior = "archive" | "pause";

export interface ScheduleSettingsInput {
  timezone?: string;
  recurringRule?: RecurringRuleInput | null;
  endBehavior?: ScheduleEndBehavior;
}

export interface CreateBundleInput {
  title: string;
  type: BundleType;
  description?: string;
  items: CreateBundleItemInput[];
  pricingRules: CreatePricingRuleInput[];
  config?: Record<string, unknown>;
  displaySettings?: Record<string, unknown>;
  scheduleSettings?: ScheduleSettingsInput;
  startsAt?: string;
  endsAt?: string;
}

export interface CreateBundleItemInput {
  shopifyProductGid: string;
  shopifyVariantGid?: string;
  title: string;
  sku?: string;
  quantity?: number;
  isRequired?: boolean;
  isDefault?: boolean;
  position?: number;
  groupName?: string;
  minQuantity?: number;
  maxQuantity?: number;
  priceOverride?: number;
}

export interface CreatePricingRuleInput {
  type: PricingRuleType;
  value: number;
  minQuantity?: number;
  maxQuantity?: number;
  minCartValue?: number;
  conditions?: Record<string, unknown>;
  priority?: number;
  isStackable?: boolean;
  startsAt?: string;
  endsAt?: string;
}

export interface AnalyticsOverview {
  totalRevenue: number;
  totalOrders: number;
  averageOrderValue: number;
  conversionRate: number;
  topBundles: Array<{
    bundleId: string;
    title: string;
    revenue: number;
    orders: number;
  }>;
  revenueTimeSeries: Array<{
    date: string;
    revenue: number;
    orders: number;
  }>;
}

// ── Shopify Types ──

export interface ShopifyWebhookPayload {
  id: number;
  [key: string]: unknown;
}

export interface ShopifySessionData {
  shop: string;
  accessToken: string;
  scope: string;
}
