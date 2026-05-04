import { describe, it, expect } from "vitest";

import { backoffMs } from "./redis";

describe("backoffMs", () => {
  it("starts at baseMs for attempt 0", () => {
    expect(backoffMs(0, 5000, 200)).toBe(200);
  });

  it("is monotonic non-decreasing", () => {
    let prev = -1;
    for (let i = 0; i < 50; i++) {
      const v = backoffMs(i, 5000, 200);
      expect(v).toBeGreaterThanOrEqual(prev);
      prev = v;
    }
  });

  it("is capped at capMs", () => {
    expect(backoffMs(1_000_000, 5000, 200)).toBe(5000);
  });

  it("handles negative attempts as 0", () => {
    expect(backoffMs(-5, 5000, 200)).toBe(200);
  });
});

describe("redis singleton", () => {
  it("imports without throwing", async () => {
    const mod = await import("./redis");
    expect(mod.redis).toBeDefined();
    // lazyConnect: true means status starts in "wait" not "connecting".
    expect(["wait", "connecting", "ready", "end"]).toContain(mod.redis.status);
  });
});
