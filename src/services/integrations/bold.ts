/**
 * Bold adapter (M-120) — Bold Subscriptions / Upsell hooks.
 *
 * Credentials: `{ apiKey: string, shopId: string }`.
 */
import type {
  FetchLike,
  IntegrationAdapter,
  IntegrationCreds,
  PingResult,
} from "./types";

const BASE = "https://api.boldcommerce.com";

function authHeaders(creds: IntegrationCreds): Record<string, string> {
  return {
    "BC-API-Key": String(creds.apiKey ?? ""),
    "Content-Type": "application/json",
  };
}

export const boldAdapter: IntegrationAdapter = {
  type: "bold",
  async ping(creds, fetcher): Promise<PingResult> {
    const f = fetcher ?? (fetch as unknown as FetchLike);
    const shopId = String(creds.shopId ?? "");
    if (!shopId) return { ok: false, message: "missing shopId" };
    try {
      const res = await f(`${BASE}/v1/shops/${shopId}`, {
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
    const shopId = String(creds.shopId ?? "");
    if (!shopId) throw new Error("Bold adapter: missing shopId in creds");
    const res = await f(`${BASE}/v1/shops/${shopId}/orders`, {
      method: "POST",
      headers: authHeaders(creds),
      body: JSON.stringify({
        external_id: order.shopifyOrderGid,
        order_number: order.shopifyOrderNumber,
        items: order.skuBreakdown.map((s) => ({
          sku: s.sku ?? s.shopifyProductGid,
          quantity: s.quantity,
        })),
      }),
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Bold ${res.status}: ${body}`);
    }
  },
};
