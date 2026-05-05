/**
 * Klaviyo adapter (M-121).
 *
 * Pushes a `Bundle Purchased` event to Klaviyo's metric API.
 * Credentials: `{ privateKey: string }` (a Klaviyo private API key).
 */
import type {
  FetchLike,
  IntegrationAdapter,
  IntegrationCreds,
  PingResult,
} from "./types";

const BASE = "https://a.klaviyo.com/api";

function authHeaders(creds: IntegrationCreds): Record<string, string> {
  const key = String(creds.privateKey ?? "");
  return {
    Authorization: `Klaviyo-API-Key ${key}`,
    revision: "2024-10-15",
    "Content-Type": "application/json",
    accept: "application/json",
  };
}

export const klaviyoAdapter: IntegrationAdapter = {
  type: "klaviyo",
  async ping(creds, fetcher): Promise<PingResult> {
    const f = fetcher ?? (fetch as unknown as FetchLike);
    if (!creds.privateKey) {
      return { ok: false, message: "missing privateKey" };
    }
    try {
      const res = await f(`${BASE}/accounts/`, {
        method: "GET",
        headers: authHeaders(creds),
      });
      return { ok: res.ok, message: res.ok ? undefined : `HTTP ${res.status}` };
    } catch (e) {
      return { ok: false, message: e instanceof Error ? e.message : String(e) };
    }
  },
  async pushOrder({ creds, order, fetcher }) {
    const f = fetcher ?? (fetch as unknown as FetchLike);
    if (!creds.privateKey) {
      throw new Error("Klaviyo adapter: missing privateKey");
    }
    const res = await f(`${BASE}/events/`, {
      method: "POST",
      headers: authHeaders(creds),
      body: JSON.stringify({
        data: {
          type: "event",
          attributes: {
            metric: { data: { type: "metric", attributes: { name: "Bundle Purchased" } } },
            properties: {
              bundle_id: order.bundleId,
              order_gid: order.shopifyOrderGid,
              order_number: order.shopifyOrderNumber,
              bundle_price: order.bundlePrice,
              currency: order.currency,
              sku_count: order.skuBreakdown.length,
            },
            unique_id: order.shopifyOrderGid,
          },
        },
      }),
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Klaviyo ${res.status}: ${body}`);
    }
  },
};
