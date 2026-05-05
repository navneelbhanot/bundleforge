/**
 * Amazon adapter (M-118) — basic stub.
 *
 * Real Amazon SP-API integration is heavier (LWA token, SigV4
 * signing). M-118 ships the adapter shape so the registry can
 * dispatch; the actual signed request lands when the user provides
 * SP-API credentials in a follow-up.
 */
import type { FetchLike, IntegrationAdapter } from "./types";

export const amazonAdapter: IntegrationAdapter = {
  type: "amazon",
  async ping(creds, fetcher) {
    const f = fetcher ?? (fetch as unknown as FetchLike);
    const endpoint = String(creds.endpoint ?? "");
    if (!endpoint) return { ok: false, message: "missing endpoint" };
    try {
      const res = await f(endpoint, { method: "GET" });
      return { ok: res.ok, message: res.ok ? undefined : `HTTP ${res.status}` };
    } catch (e) {
      return { ok: false, message: e instanceof Error ? e.message : String(e) };
    }
  },
  async pushOrder({ order }) {
    // Stub: real SP-API order forwarding is a follow-up. Logging via
    // the registry's error handling is enough for now.
    if (!order.shopifyOrderGid) {
      throw new Error("Amazon adapter: order missing GID");
    }
  },
};
