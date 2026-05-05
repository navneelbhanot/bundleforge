import { describe, it, expect } from "vitest";
import type { Session } from "@shopify/shopify-api";

import { shopifyRest, type RestClientLike, type RestResponseLike } from "./rest";

const session = { shop: "demo.myshopify.com" } as unknown as Session;

function clientReturning<T>(...responses: RestResponseLike<T>[]): RestClientLike {
  let i = 0;
  const next = (): RestResponseLike<T> => {
    const r = responses[i] ?? responses[responses.length - 1];
    i++;
    return r;
  };
  const handler = async (): Promise<RestResponseLike<unknown>> =>
    next() as RestResponseLike<unknown>;
  return {
    get: handler,
    post: handler,
    put: handler,
    delete: handler,
  } as unknown as RestClientLike;
}

describe("shopifyRest", () => {
  it("returns body on 200", async () => {
    const c = clientReturning<{ ok: boolean }>({ statusCode: 200, body: { ok: true } });
    const out = await shopifyRest<{ ok: boolean }>(
      session,
      { method: "GET", path: "/x.json" },
      { clientFactory: () => c, sleepMs: 0 },
    );
    expect(out).toEqual({ ok: true });
  });

  it("retries on 429 then returns body", async () => {
    const c = clientReturning<{ ok: boolean }>(
      { statusCode: 429, body: {} as { ok: boolean } },
      { statusCode: 200, body: { ok: true } },
    );
    const out = await shopifyRest<{ ok: boolean }>(
      session,
      { method: "GET", path: "/x.json" },
      { clientFactory: () => c, sleepMs: 0 },
    );
    expect(out).toEqual({ ok: true });
  });

  it("throws when both attempts return 429", async () => {
    const c = clientReturning<{ ok: boolean }>(
      { statusCode: 429, body: {} as { ok: boolean } },
      { statusCode: 429, body: {} as { ok: boolean } },
    );
    await expect(
      shopifyRest(
        session,
        { method: "GET", path: "/x.json" },
        { clientFactory: () => c, sleepMs: 0 },
      ),
    ).rejects.toThrow(/429/);
  });

  it("throws on non-429 4xx without retry", async () => {
    const c = clientReturning<{ ok: boolean }>({
      statusCode: 404,
      body: {} as { ok: boolean },
    });
    await expect(
      shopifyRest(
        session,
        { method: "GET", path: "/missing.json" },
        { clientFactory: () => c, sleepMs: 0 },
      ),
    ).rejects.toThrow(/404/);
  });
});
