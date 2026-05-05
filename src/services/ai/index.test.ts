import { describe, it, expect, vi, beforeEach } from "vitest";

import { enabled, recommend, type FetchLike } from "./index";

const baseOpts = { url: "https://ai.example.com", apiKey: "test-key" };

describe("enabled", () => {
  it("false when url + apiKey missing", () => {
    expect(enabled({ url: "", apiKey: "" })).toBe(false);
  });

  it("true when both set", () => {
    expect(enabled(baseOpts)).toBe(true);
  });
});

describe("recommend", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns [] when AI is disabled", async () => {
    const fetcher = vi.fn();
    const out = await recommend(
      { baskets: [["a", "b"]], target: "a" },
      { url: "", apiKey: "", fetcher: fetcher as unknown as FetchLike },
    );
    expect(out).toEqual([]);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("calls /recommendations with bearer auth and parses response", async () => {
    const fetcher: FetchLike = vi.fn(async () => ({
      ok: true,
      status: 200,
      text: async () =>
        JSON.stringify({
          target: "a",
          recommendations: [
            { product_id: "b", support: 0.5, confidence: 0.5, lift: 1.5 },
          ],
        }),
    }));
    const out = await recommend(
      { baskets: [["a", "b"]], target: "a", topN: 3 },
      { ...baseOpts, fetcher },
    );
    expect(out).toHaveLength(1);
    expect(out[0].product_id).toBe("b");
    const call = (fetcher as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(call[0]).toBe("https://ai.example.com/recommendations");
    const init = call[1];
    expect(init?.headers?.Authorization).toBe("Bearer test-key");
    expect(JSON.parse(init?.body ?? "{}").top_n).toBe(3);
  });

  it("returns [] on non-2xx", async () => {
    const fetcher: FetchLike = vi.fn(async () => ({
      ok: false,
      status: 503,
      text: async () => "down",
    }));
    const out = await recommend(
      { baskets: [["a", "b"]], target: "a" },
      { ...baseOpts, fetcher },
    );
    expect(out).toEqual([]);
  });

  it("returns [] when fetcher throws", async () => {
    const fetcher: FetchLike = vi.fn(async () => {
      throw new Error("network");
    });
    const out = await recommend(
      { baskets: [["a", "b"]], target: "a" },
      { ...baseOpts, fetcher },
    );
    expect(out).toEqual([]);
  });
});
