import { describe, it, expect } from "vitest";

import {
  BUNDLE_PROP,
  extractBundleLineItems,
} from "./extract";

describe("extractBundleLineItems", () => {
  it("returns empty for orders without bundle-marked items", () => {
    expect(
      extractBundleLineItems({
        line_items: [{ id: 1, title: "Plain" }],
      }),
    ).toEqual([]);
  });

  it("returns line items that carry the bundle marker", () => {
    const r = extractBundleLineItems({
      line_items: [
        { id: 1, title: "Plain" },
        {
          id: 2,
          title: "Bundle Item",
          properties: [{ name: BUNDLE_PROP, value: "b-uuid" }],
        },
      ],
    });
    expect(r).toHaveLength(1);
    expect(r[0].bundleId).toBe("b-uuid");
    expect(r[0].lineItem.id).toBe(2);
  });

  it("ignores items whose marker has empty value", () => {
    const r = extractBundleLineItems({
      line_items: [
        {
          id: 2,
          properties: [{ name: BUNDLE_PROP, value: "" }],
        },
      ],
    });
    expect(r).toEqual([]);
  });
});
