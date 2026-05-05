import { describe, it, expect, vi } from "vitest";
import type { Session } from "@shopify/shopify-api";

import {
  shopifyGraphql,
  type GraphqlClientLike,
  type GraphqlResponse,
} from "./graphql";

const session = { shop: "demo.myshopify.com" } as unknown as Session;

function clientReturning<T>(...responses: GraphqlResponse<T>[]): GraphqlClientLike {
  let i = 0;
  return {
    async request<U>(): Promise<GraphqlResponse<U>> {
      const r = responses[i] ?? responses[responses.length - 1];
      i++;
      return r as unknown as GraphqlResponse<U>;
    },
  };
}

describe("shopifyGraphql", () => {
  it("returns data on happy path", async () => {
    const c = clientReturning<{ ok: boolean }>({ data: { ok: true } });
    const out = await shopifyGraphql<{ ok: boolean }>(session, "Q", undefined, {
      clientFactory: () => c,
      sleepMs: 0,
    });
    expect(out).toEqual({ ok: true });
  });

  it("retries once on THROTTLED then succeeds", async () => {
    const c = clientReturning<{ ok: boolean }>(
      { errors: [{ message: "Throttled", extensions: { code: "THROTTLED" } }] },
      { data: { ok: true } },
    );
    const out = await shopifyGraphql<{ ok: boolean }>(session, "Q", undefined, {
      clientFactory: () => c,
      sleepMs: 0,
    });
    expect(out).toEqual({ ok: true });
  });

  it("throws when both attempts are throttled", async () => {
    const c = clientReturning<{ ok: boolean }>(
      { errors: [{ message: "Throttled", extensions: { code: "THROTTLED" } }] },
      { errors: [{ message: "Throttled", extensions: { code: "THROTTLED" } }] },
    );
    await expect(
      shopifyGraphql(session, "Q", undefined, {
        clientFactory: () => c,
        sleepMs: 0,
      }),
    ).rejects.toThrow(/Throttled/);
  });

  it("throws immediately on non-throttle errors (no retry)", async () => {
    const request = vi
      .fn()
      .mockResolvedValueOnce({ errors: [{ message: "Field 'x' not found" }] });
    await expect(
      shopifyGraphql(session, "Q", undefined, {
        clientFactory: () => ({ request }) as unknown as GraphqlClientLike,
        sleepMs: 0,
      }),
    ).rejects.toThrow(/not found/);
    expect(request).toHaveBeenCalledTimes(1);
  });

  it("throws when response has neither data nor errors", async () => {
    const c = clientReturning<unknown>({});
    await expect(
      shopifyGraphql(session, "Q", undefined, {
        clientFactory: () => c,
        sleepMs: 0,
      }),
    ).rejects.toThrow(/no data/);
  });
});
