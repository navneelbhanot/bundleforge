import { describe, it, expect } from "vitest";

import { assign, hashFraction, significance } from "./abTest";

describe("hashFraction / assign", () => {
  it("is deterministic for the same sessionId", () => {
    const a = hashFraction("session-abc");
    const b = hashFraction("session-abc");
    expect(a).toBe(b);
  });

  it("returns a value in [0, 1)", () => {
    for (const s of ["a", "b", "long-session-id-with-chars-!@#"]) {
      const f = hashFraction(s);
      expect(f).toBeGreaterThanOrEqual(0);
      expect(f).toBeLessThan(1);
    }
  });

  it("trafficSplit 0 always returns A", () => {
    for (let i = 0; i < 50; i++) {
      expect(assign({ sessionId: `s-${i}`, trafficSplit: 0 })).toBe("A");
    }
  });

  it("trafficSplit 1 always returns B", () => {
    for (let i = 0; i < 50; i++) {
      expect(assign({ sessionId: `s-${i}`, trafficSplit: 1 })).toBe("B");
    }
  });

  it("trafficSplit 0.5 produces roughly half-and-half over many sessions", () => {
    let bs = 0;
    const N = 1000;
    for (let i = 0; i < N; i++) {
      if (assign({ sessionId: `session-${i}` }) === "B") bs += 1;
    }
    expect(bs).toBeGreaterThan(N * 0.4);
    expect(bs).toBeLessThan(N * 0.6);
  });
});

describe("significance (two-proportion z-test)", () => {
  it("returns p=1, no winner when one variant has zero exposures", () => {
    const r = significance({ conversions: 1, exposures: 0 }, { conversions: 0, exposures: 100 });
    expect(r.significant).toBe(false);
    expect(r.winner).toBeNull();
  });

  it("returns no winner when rates are identical", () => {
    const r = significance(
      { conversions: 50, exposures: 1000 },
      { conversions: 50, exposures: 1000 },
    );
    expect(r.significant).toBe(false);
    expect(r.winner).toBeNull();
  });

  it("declares B winner when B is much higher with large samples", () => {
    const r = significance(
      { conversions: 50, exposures: 1000 },
      { conversions: 100, exposures: 1000 },
    );
    expect(r.significant).toBe(true);
    expect(r.winner).toBe("B");
    expect(r.p).toBeLessThan(0.001);
  });

  it("declares A winner when A is much higher", () => {
    const r = significance(
      { conversions: 200, exposures: 1000 },
      { conversions: 100, exposures: 1000 },
    );
    expect(r.significant).toBe(true);
    expect(r.winner).toBe("A");
  });

  it("non-significant for tiny samples", () => {
    const r = significance(
      { conversions: 1, exposures: 5 },
      { conversions: 2, exposures: 5 },
    );
    expect(r.significant).toBe(false);
  });
});
