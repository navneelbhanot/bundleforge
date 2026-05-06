import { describe, it, expect } from "vitest";

import { BUNDLE_TEMPLATES, findTemplate } from "./templates";
import { BUNDLE_TYPES, validateBundleConfig } from "./validators";

describe("BUNDLE_TEMPLATES (M-179)", () => {
  it("is non-empty", () => {
    expect(BUNDLE_TEMPLATES.length).toBeGreaterThan(0);
  });

  it("every template uses a known BundleType", () => {
    const known = new Set(BUNDLE_TYPES as readonly string[]);
    for (const t of BUNDLE_TEMPLATES) {
      expect(known.has(t.type)).toBe(true);
    }
  });

  it("every template's config validates against the per-type schema", () => {
    for (const t of BUNDLE_TEMPLATES) {
      // Throws ZodError on mismatch — passing here is the assertion.
      expect(() => validateBundleConfig(t.type, t.config)).not.toThrow();
    }
  });

  it("template ids are unique", () => {
    const ids = BUNDLE_TEMPLATES.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("findTemplate returns the template by id and undefined for unknown ids", () => {
    expect(findTemplate(BUNDLE_TEMPLATES[0].id)).toBeTruthy();
    expect(findTemplate("does-not-exist")).toBeUndefined();
  });
});
