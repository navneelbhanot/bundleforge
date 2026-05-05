/**
 * ShipStation adapter (M-117).
 *
 * Pings via /accounts; pushes orders via /orders/createorder.
 * Credentials shape: `{ apiKey: string, apiSecret: string }`.
 */
import type {
  BundleOrderEvent,
  FetchLike,
  IntegrationAdapter,
  IntegrationCreds,
  PingResult,
} from "./types";

const BASE = "https://ssapi.shipstation.com";

function authHeader(creds: IntegrationCreds): string {
  const k = String(creds.apiKey ?? "");
  const s = String(creds.apiSecret ?? "");
  const token = Buffer.from(`${k}:${s}`).toString("base64");
  return `Basic ${token}`;
}

export const shipstationAdapter: IntegrationAdapter = {
  type: "shipstation",
  async ping(creds, fetcher): Promise<PingResult> {
    const f = fetcher ?? (fetch as unknown as FetchLike);
    try {
      const res = await f(`${BASE}/accounts/listtags`, {
        method: "GET",
        headers: {
          Authorization: authHeader(creds),
          "Content-Type": "application/json",
        },
      });
      if (!res.ok) return { ok: false, message: `HTTP ${res.status}` };
      return { ok: true };
    } catch (e) {
      return { ok: false, message: e instanceof Error ? e.message : String(e) };
    }
  },
  async pushOrder({ creds, order, fetcher }) {
    const f = fetcher ?? (fetch as unknown as FetchLike);
    const items = order.skuBreakdown.map((s) => ({
      sku: s.sku ?? s.shopifyProductGid,
      name: s.title ?? "Bundle item",
      quantity: s.quantity,
      unitPrice: 0,
    }));
    const res = await f(`${BASE}/orders/createorder`, {
      method: "POST",
      headers: {
        Authorization: authHeader(creds),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        orderNumber: order.shopifyOrderNumber,
        orderKey: order.shopifyOrderGid,
        orderDate: new Date().toISOString(),
        orderStatus: "awaiting_shipment",
        items,
      }),
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`ShipStation ${res.status}: ${body}`);
    }
  },
};
