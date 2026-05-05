import { describe, it, expect } from "vitest";

import { convertBundlerCsv } from "./bundler";

describe("convertBundlerCsv", () => {
  it("maps two rows with pipe-separated items", () => {
    const csv =
      "title,type,items_pipe,discount_type,discount_value\n" +
      "Bundle A,classic,gid1|gid2|gid3,percent,10\n" +
      "Bundle B,mix_and_match,gid4|gid5,flat,2.50\n";
    const r = convertBundlerCsv(csv);
    expect(r.errors).toEqual([]);
    expect(r.bundles).toHaveLength(2);
    expect(r.bundles[0].type).toBe("fixed");
    expect(r.bundles[0].items).toHaveLength(3);
    expect(r.bundles[0].pricingRules[0].type).toBe("percentage");
    expect(r.bundles[1].type).toBe("mix_match");
    expect(r.bundles[1].pricingRules[0].type).toBe("flat_discount");
    expect(r.bundles[1].pricingRules[0].value).toBe(2.5);
  });

  it("captures rows missing a title", () => {
    const csv = "title,type,items_pipe\n,classic,gid1\n";
    const r = convertBundlerCsv(csv);
    expect(r.errors).toHaveLength(1);
  });

  it("falls back to fixed type for unknown bundle type", () => {
    const csv =
      "title,type,items_pipe,discount_type,discount_value\nX,exotic,gid1,percent,5\n";
    const r = convertBundlerCsv(csv);
    expect(r.bundles[0].type).toBe("fixed");
  });

  it("skips pricing rule when discount_value is 0 or non-numeric", () => {
    const csv =
      "title,type,items_pipe,discount_type,discount_value\nA,classic,gid1,percent,0\nB,classic,gid1,percent,abc\n";
    const r = convertBundlerCsv(csv);
    expect(r.bundles[0].pricingRules).toHaveLength(0);
    expect(r.bundles[1].pricingRules).toHaveLength(0);
  });
});
