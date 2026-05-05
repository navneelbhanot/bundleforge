import { describe, it, expect, vi } from "vitest";

import { shipstationAdapter } from "./shipstation";

const creds = { apiKey: "k", apiSecret: "s" };
const order = {
  shopifyOrderGid: "gid://Order/1",
  shopifyOrderNumber: "#1001",
  bundleId: "b",
  currency: "USD",
  bundlePrice: "30.00",
  skuBreakdown: [
    { sku: "A", shopifyProductGid: "gid://x", quantity: 2, title: "Item" },
  ],
};

type FetchInit = { method?: string; headers?: Record<string, string>; body?: string };

function mockFetch(
  impl: (url: string) => { ok: boolean; status: number; body?: string },
) {
  return vi.fn(async (url: string, _init?: FetchInit) => {
    const r = impl(url);
    return {
      ok: r.ok,
      status: r.status,
      text: async () => r.body ?? "",
    };
  });
}

describe("shipstation.ping", () => {
  it("returns ok:true on 200", async () => {
    const f = mockFetch(() => ({ ok: true, status: 200 }));
    const r = await shipstationAdapter.ping(creds, f);
    expect(r.ok).toBe(true);
  });

  it("returns ok:false with HTTP message on non-2xx", async () => {
    const f = mockFetch(() => ({ ok: false, status: 401 }));
    const r = await shipstationAdapter.ping(creds, f);
    expect(r.ok).toBe(false);
    expect(r.message).toMatch(/401/);
  });

  it("returns ok:false on fetch throw", async () => {
    const f = vi.fn(async () => {
      throw new Error("network down");
    });
    const r = await shipstationAdapter.ping(creds, f as unknown as typeof fetch as never);
    expect(r.ok).toBe(false);
    expect(r.message).toMatch(/network down/);
  });
});

describe("shipstation.pushOrder", () => {
  it("posts an order with mapped items + Basic auth", async () => {
    const f = mockFetch(() => ({ ok: true, status: 201 }));
    await shipstationAdapter.pushOrder!({ creds, order, fetcher: f });
    expect(f).toHaveBeenCalledTimes(1);
    const [url, init] = f.mock.calls[0];
    expect(url).toMatch(/createorder/);
    expect((init?.headers ?? {})["Authorization"]).toMatch(/^Basic /);
    const body = JSON.parse(init?.body ?? "{}");
    expect(body.orderNumber).toBe("#1001");
    expect(body.items).toHaveLength(1);
    expect(body.items[0].quantity).toBe(2);
  });

  it("throws on non-2xx", async () => {
    const f = mockFetch(() => ({ ok: false, status: 422, body: "validation" }));
    await expect(
      shipstationAdapter.pushOrder!({ creds, order, fetcher: f }),
    ).rejects.toThrow(/422/);
  });
});
