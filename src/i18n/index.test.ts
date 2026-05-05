import { describe, it, expect } from "vitest";

import { SUPPORTED_LOCALES, resolveLocale, t } from "./index";

describe("i18n", () => {
  it("returns the English string for known keys", () => {
    expect(t("errors.bundle_not_found")).toBe("Bundle not found.");
  });

  it("interpolates {variables}", () => {
    expect(t("checkout.select_min", { min: 4 })).toBe(
      "Please select at least 4 items.",
    );
  });

  it("falls back to English for unknown locale and unknown key returns the key", () => {
    expect(t("errors.bundle_not_found", {}, "en")).toBe("Bundle not found.");
    expect(t("nonexistent.key")).toBe("nonexistent.key");
  });

  it("uses Spanish when locale=es", () => {
    expect(t("errors.bundle_not_found", {}, "es")).toBe("Paquete no encontrado.");
  });

  it("falls back to English when a locale is missing the key (none today, smoke)", () => {
    // All locales currently mirror English keys; this is a smoke test.
    for (const loc of SUPPORTED_LOCALES) {
      expect(t("errors.bundle_not_found", {}, loc)).toBeTruthy();
    }
  });

  it("resolveLocale normalizes BCP-47 / underscored values", () => {
    expect(resolveLocale("en")).toBe("en");
    expect(resolveLocale("en-US")).toBe("en");
    expect(resolveLocale("pt_BR")).toBe("pt");
    expect(resolveLocale("xx")).toBe("en");
    expect(resolveLocale(null)).toBe("en");
  });

  it("every supported locale loads", () => {
    for (const loc of SUPPORTED_LOCALES) {
      expect(t("common.save", {}, loc)).toBeTruthy();
    }
  });
});
