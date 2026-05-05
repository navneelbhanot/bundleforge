import { describe, it, expect, vi } from "vitest";

import { klaviyoAdapter } from "./klaviyo";

const order = {
  shopifyOrderGid: "gid://Order/1",
  shopifyOrderNumber: "#1001",
  bundleId: "b-1",
  currency: "USD",
  bundlePrice: "30.00",
  skuBreakdown: [
    { sku: "A", shopifyProductGid: "gid://x", quantity: 2, title: "Widget" },
  ],
};

type FetchInit = { method?: string; headers?: Record<string, string>; body?: string };

function mockFetch(impl: (url: string, init?: FetchInit) => { ok: boolean; status: number; body?: string }) {
  return vi.fn(async (url: string, init?: FetchInit) => {
    const r = impl(url, init);
    return { ok: r.ok, status: r.status, text: async () => r.body ?? "" };
  });
}

describe("klaviyo.ping", () => {
  it("returns ok:true on 200", async () => {
    const f = mockFetch(() => ({ ok: true, status: 200 }));
    const r = await klaviyoAdapter.ping({ privateKey: "pk_x" }, f);
    expect(r.ok).toBe(true);
  });

  it("returns ok:false when private key missing", async () => {
    const r = await klaviyoAdapter.ping({}, vi.fn());
    expect(r.ok).toBe(false);
    expect(r.message).toMatch(/privateKey/);
  });
});

describe("klaviyo.pushOrder", () => {
  it("posts a Bundle Purchased event", async () => {
    const f = mockFetch(() => ({ ok: true, status: 202 }));
    await klaviyoAdapter.pushOrder!({
      creds: { privateKey: "pk_x" },
      order,
      fetcher: f,
    });
    expect(f).toHaveBeenCalledTimes(1);
    const [url, init] = f.mock.calls[0];
    expect(url).toMatch(/\/events\//);
    expect((init?.headers ?? {})["Authorization"]).toMatch(/^Klaviyo-API-Key/);
    const body = JSON.parse(init?.body ?? "{}");
    expect(body.data.attributes.metric.data.attributes.name).toBe("Bundle Purchased");
    expect(body.data.attributes.properties.bundle_id).toBe("b-1");
    expect(body.data.attributes.unique_id).toBe("gid://Order/1");
  });

  it("throws on non-2xx", async () => {
    const f = mockFetch(() => ({ ok: false, status: 401, body: "unauth" }));
    await expect(
      klaviyoAdapter.pushOrder!({
        creds: { privateKey: "pk_x" },
        order,
        fetcher: f,
      }),
    ).rejects.toThrow(/401/);
  });

  it("throws when private key missing", async () => {
    await expect(
      klaviyoAdapter.pushOrder!({ creds: {}, order, fetcher: vi.fn() }),
    ).rejects.toThrow(/privateKey/);
  });
});
