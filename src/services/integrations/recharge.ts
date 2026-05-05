/**
 * Recharge adapter (M-119) — subscription bundle hook.
 *
 * Recharge subscribes customers to recurring orders. The hook fires
 * when a subscription bundle is purchased; we forward the bundle
 * configuration to Recharge so it can create the subscription.
 *
 * Credentials: `{ accessToken: string }` (Recharge X-Recharge-Access-Token).
 */
import type {
  FetchLike,
  IntegrationAdapter,
  IntegrationCreds,
  PingResult,
} from "./types";

const BASE = "https://api.rechargeapps.com";

function authHeaders(creds: IntegrationCreds): Record<string, string> {
  return {
    "X-Recharge-Access-Token": String(creds.accessToken ?? ""),
    "Content-Type": "application/json",
  };
}

export const rechargeAdapter: IntegrationAdapter = {
  type: "recharge",
  async ping(creds, fetcher): Promise<PingResult> {
    const f = fetcher ?? (fetch as unknown as FetchLike);
    try {
      const res = await f(`${BASE}/shop`, {
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
    const res = await f(`${BASE}/checkouts`, {
      method: "POST",
      headers: authHeaders(creds),
      body: JSON.stringify({
        external_order_id: order.shopifyOrderGid,
        line_items: order.skuBreakdown.map((s) => ({
          variant_id: s.shopifyProductGid,
          quantity: s.quantity,
        })),
      }),
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Recharge ${res.status}: ${body}`);
    }
  },
};
