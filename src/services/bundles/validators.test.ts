import { describe, it, expect } from "vitest";
import { z } from "zod";

import {
  BUNDLE_TYPES,
  bundleConfigSchema,
  validateBundleConfig,
} from "./validators";

describe("BUNDLE_TYPES", () => {
  it("contains all 13 types", () => {
    expect(BUNDLE_TYPES.length).toBe(13);
    expect(BUNDLE_TYPES).toContain("fixed");
    expect(BUNDLE_TYPES).toContain("custom");
  });
});

describe("bundleConfigSchema discriminated union", () => {
  it("accepts a fixed bundle with empty config", () => {
    const r = bundleConfigSchema.parse({ type: "fixed", config: {} });
    expect(r.type).toBe("fixed");
  });

  it("accepts mix_match with min/max", () => {
    const r = bundleConfigSchema.parse({
      type: "mix_match",
      config: { minItems: 1, maxItems: 5 },
    });
    expect((r.config as { allowDuplicates: boolean }).allowDuplicates).toBe(false);
  });

  it("rejects mix_match where maxItems < minItems", () => {
    expect(() =>
      bundleConfigSchema.parse({
        type: "mix_match",
        config: { minItems: 10, maxItems: 5 },
      }),
    ).toThrow();
  });

  it("accepts build_box with steps", () => {
    const r = bundleConfigSchema.parse({
      type: "build_box",
      config: {
        minItems: 4,
        maxItems: 4,
        allowDuplicates: false,
        steps: [
          { name: "Step 1", pickCount: 2 },
          { name: "Step 2", pickCount: 2 },
        ],
      },
    });
    expect(((r.config as { steps: unknown[] }).steps).length).toBe(2);
  });

  it("rejects build_box step with non-positive pickCount", () => {
    expect(() =>
      bundleConfigSchema.parse({
        type: "build_box",
        config: {
          minItems: 1,
          maxItems: 4,
          steps: [{ name: "S", pickCount: 0 }],
        },
      }),
    ).toThrow();
  });

  it("multipack requires packQuantity", () => {
    expect(() =>
      bundleConfigSchema.parse({ type: "multipack", config: {} }),
    ).toThrow();
    const r = bundleConfigSchema.parse({
      type: "multipack",
      config: { packQuantity: 6 },
    });
    expect((r.config as { packQuantity: number }).packQuantity).toBe(6);
  });

  it("custom bundle accepts any config", () => {
    const r = bundleConfigSchema.parse({
      type: "custom",
      config: { anything: "goes", nested: { ok: true } },
    });
    expect(r.type).toBe("custom");
  });

  it("rejects unknown type", () => {
    let err: unknown;
    try {
      bundleConfigSchema.parse({ type: "nonexistent", config: {} });
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(z.ZodError);
  });
});

describe("validateBundleConfig", () => {
  it("returns the parsed config", () => {
    const cfg = validateBundleConfig("multipack", { packQuantity: 3 });
    expect((cfg as { packQuantity: number }).packQuantity).toBe(3);
  });

  it("throws on invalid", () => {
    expect(() =>
      validateBundleConfig("multipack", { packQuantity: 0 }),
    ).toThrow();
  });
});
