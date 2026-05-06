import { describe, it, expect } from "vitest";

import {
  ILLUSTRATIONS,
  getIllustration,
  type IllustrationName,
} from "./illustrations";

describe("ILLUSTRATIONS (M-183)", () => {
  it("every entry returns a non-empty data URI starting with data:image/svg+xml", () => {
    const names = Object.keys(ILLUSTRATIONS) as IllustrationName[];
    expect(names.length).toBeGreaterThan(0);
    for (const name of names) {
      const uri = ILLUSTRATIONS[name];
      expect(typeof uri).toBe("string");
      expect(uri.startsWith("data:image/svg+xml")).toBe(true);
    }
  });

  it("getIllustration returns the empty string for an undefined name", () => {
    expect(getIllustration(undefined)).toBe("");
  });

  it("getIllustration resolves a known name to its SVG data URI", () => {
    expect(getIllustration("orders")).toBe(ILLUSTRATIONS.orders);
    expect(getIllustration("ai")).toBe(ILLUSTRATIONS.ai);
  });
});
