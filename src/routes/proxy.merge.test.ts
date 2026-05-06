import { describe, it, expect } from "vitest";

import { resolveDisplaySettings } from "./proxy";

describe("resolveDisplaySettings (M-171b)", () => {
  it("shop default applies when bundle override is empty", () => {
    const out = resolveDisplaySettings(
      { display: { layout: "list", colorPreset: "neutral" } },
      {},
    );
    expect(out.layout).toBe("list");
    expect(out.colorPreset).toBe("neutral");
  });

  it("bundle override wins over shop default", () => {
    const out = resolveDisplaySettings(
      { display: { layout: "list" } },
      { layout: "carousel" },
    );
    expect(out.layout).toBe("carousel");
  });

  it("only known M-171 keys are exposed", () => {
    const out = resolveDisplaySettings(
      {
        display: {
          layout: "grid",
          // Unknown key — must NOT leak through.
          adminOnly: "secret",
        },
      },
      {},
    );
    expect(out.layout).toBe("grid");
    expect("adminOnly" in out).toBe(false);
  });

  it("null in shop and bundle → key omitted from output", () => {
    const out = resolveDisplaySettings(
      { display: { layout: null } },
      { layout: null },
    );
    expect("layout" in out).toBe(false);
  });

  it("non-object inputs are tolerated (defaults to {})", () => {
    expect(resolveDisplaySettings(null, null)).toEqual({});
    expect(resolveDisplaySettings("nope", "nope")).toEqual({});
    expect(resolveDisplaySettings([], [])).toEqual({});
  });

  it("merges across all six keys", () => {
    const out = resolveDisplaySettings(
      {
        display: {
          layout: "list",
          colorPreset: "neutral",
          imagePreference: "bundle_hero",
          addToCartCopy: "Add bundle",
          soldOutBehavior: "hide",
          cssOverride: "color: red",
        },
      },
      { addToCartCopy: "Get this bundle" },
    );
    expect(out).toEqual({
      layout: "list",
      colorPreset: "neutral",
      imagePreference: "bundle_hero",
      addToCartCopy: "Get this bundle",
      soldOutBehavior: "hide",
      cssOverride: "color: red",
    });
  });
});
