/**
 * Storefront eligibility tests (M-172c).
 *
 * Tests the helper exported from
 * `extensions/theme-extension/assets/mintbundle-bundle.js`.
 * The module guards `customElements.define` and stubs
 * `HTMLElement` so it loads cleanly in node.
 */
import { describe, it, expect } from "vitest";

// Dynamic import path — vitest excludes
// `extensions/theme-extension` from test discovery, so this
// file lives in `tests/storefront/` and imports the module
// at runtime.
const modulePath =
  "../../extensions/theme-extension/assets/mintbundle-bundle.js";

describe("isEligibleStorefront (M-172c)", () => {
  const ctxAnon = {
    customerId: "",
    customerTags: [],
    country: "US",
    language: "en",
  };
  const ctxLoggedIn = {
    customerId: "gid://shopify/Customer/1",
    customerTags: [],
    country: "US",
    language: "en",
  };
  const ctxVip = {
    customerId: "gid://shopify/Customer/1",
    customerTags: ["vip", "early-access"],
    country: "US",
    language: "en",
  };

  it("no metafield → eligible", async () => {
    const m = await import(modulePath);
    expect(m.isEligibleStorefront(null, ctxAnon)).toBe(true);
    expect(m.isEligibleStorefront({}, ctxAnon)).toBe(true);
  });

  it("requireLogin=true blocks anonymous", async () => {
    const m = await import(modulePath);
    expect(m.isEligibleStorefront({ requireLogin: true }, ctxAnon)).toBe(false);
    expect(m.isEligibleStorefront({ requireLogin: true }, ctxLoggedIn)).toBe(true);
  });

  it("customerTagsAllow: customer matches → eligible", async () => {
    const m = await import(modulePath);
    expect(
      m.isEligibleStorefront({ customerTagsAllow: ["vip"] }, ctxVip),
    ).toBe(true);
  });

  it("customerTagsAllow: no match → not eligible", async () => {
    const m = await import(modulePath);
    expect(
      m.isEligibleStorefront({ customerTagsAllow: ["vip"] }, ctxLoggedIn),
    ).toBe(false);
  });

  it("allow + deny: allow wins (M-172 Banner copy)", async () => {
    const m = await import(modulePath);
    const blob = {
      customerTagsAllow: ["vip"],
      customerTagsDeny: ["wholesale"],
    };
    const ctx = {
      customerId: "gid://shopify/Customer/1",
      customerTags: ["vip", "wholesale"],
      country: "US",
      language: "en",
    };
    expect(m.isEligibleStorefront(blob, ctx)).toBe(true);
  });

  it("customerTagsDeny only: customer has deny tag → not eligible", async () => {
    const m = await import(modulePath);
    const ctx = {
      customerId: "gid://shopify/Customer/1",
      customerTags: ["wholesale"],
      country: "US",
      language: "en",
    };
    expect(
      m.isEligibleStorefront({ customerTagsDeny: ["wholesale"] }, ctx),
    ).toBe(false);
  });

  it("markets='US' + country='CA' → not eligible", async () => {
    const m = await import(modulePath);
    expect(
      m.isEligibleStorefront(
        { markets: ["US"] },
        { ...ctxAnon, country: "CA" },
      ),
    ).toBe(false);
  });

  it("locales='en' + language='fr' → not eligible", async () => {
    const m = await import(modulePath);
    expect(
      m.isEligibleStorefront(
        { locales: ["en"] },
        { ...ctxAnon, language: "fr" },
      ),
    ).toBe(false);
  });

  it("multi-rule: all must pass", async () => {
    const m = await import(modulePath);
    const blob = {
      requireLogin: true,
      markets: ["US"],
      locales: ["en"],
      customerTagsAllow: ["vip"],
    };
    expect(m.isEligibleStorefront(blob, ctxVip)).toBe(true);
    expect(m.isEligibleStorefront(blob, ctxLoggedIn)).toBe(false);
    expect(
      m.isEligibleStorefront(blob, { ...ctxVip, country: "CA" }),
    ).toBe(false);
  });
});

describe("readStorefrontContext (M-172c)", () => {
  it("reads data-* attributes off the element", async () => {
    const m = await import(modulePath);
    const fakeElem = {
      getAttribute: (name: string) => {
        const map: Record<string, string> = {
          "data-customer-id": "gid://shopify/Customer/42",
          "data-customer-tags": "vip,early-access",
          "data-country": "US",
          "data-language": "en",
        };
        return map[name] ?? null;
      },
    };
    expect(m.readStorefrontContext(fakeElem)).toEqual({
      customerId: "gid://shopify/Customer/42",
      customerTags: ["vip", "early-access"],
      country: "US",
      language: "en",
    });
  });

  it("missing element → empty context", async () => {
    const m = await import(modulePath);
    expect(m.readStorefrontContext(null)).toEqual({
      customerId: "",
      customerTags: [],
      country: "",
      language: "",
    });
  });

  it("empty data-customer-tags → []", async () => {
    const m = await import(modulePath);
    const fakeElem = {
      getAttribute: () => "",
    };
    expect(m.readStorefrontContext(fakeElem)).toEqual({
      customerId: "",
      customerTags: [],
      country: "",
      language: "",
    });
  });
});
