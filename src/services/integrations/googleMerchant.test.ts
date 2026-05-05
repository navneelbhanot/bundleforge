import { describe, it, expect } from "vitest";

import { buildGoogleMerchantFeed } from "./googleMerchant";

describe("buildGoogleMerchantFeed", () => {
  it("emits valid XML with one entry per bundle", () => {
    const xml = buildGoogleMerchantFeed(
      "Demo Shop",
      [
        {
          slug: "summer-box",
          title: "Summer Box",
          description: "Beach essentials",
          priceUsd: 29.99,
          url: "https://demo.myshopify.com/bundles/summer-box",
          imageUrl: "https://demo.myshopify.com/img.jpg",
        },
      ],
      new Date("2026-05-05T00:00:00Z"),
    );
    expect(xml).toMatch(/<\?xml version="1.0" encoding="UTF-8"\?>/);
    expect(xml).toMatch(/<entry>/);
    expect(xml).toMatch(/<g:id>summer-box<\/g:id>/);
    expect(xml).toMatch(/<g:price>29.99 USD<\/g:price>/);
    expect(xml).toMatch(/<g:availability>in_stock<\/g:availability>/);
    expect(xml).toMatch(/<g:image_link>/);
  });

  it("escapes special characters in title/description", () => {
    const xml = buildGoogleMerchantFeed(
      "Shop & Co",
      [
        {
          slug: "ampersand",
          title: "Coffee & Tea",
          description: 'Tasty <"good"> bundles',
          priceUsd: 5,
          url: "https://x/bundles/ampersand",
        },
      ],
    );
    expect(xml).toMatch(/Coffee &amp; Tea/);
    expect(xml).toMatch(/&lt;&quot;good&quot;&gt;/);
    expect(xml).toMatch(/Shop &amp; Co/);
  });

  it("omits image_link when imageUrl is missing", () => {
    const xml = buildGoogleMerchantFeed(
      "Demo Shop",
      [
        {
          slug: "no-img",
          title: "No image",
          description: null,
          priceUsd: 10,
          url: "https://x/no-img",
        },
      ],
    );
    expect(xml).not.toMatch(/<g:image_link>/);
  });

  it("respects availability override", () => {
    const xml = buildGoogleMerchantFeed(
      "Demo",
      [
        {
          slug: "oos",
          title: "Out of stock pack",
          description: null,
          priceUsd: 1,
          url: "https://x/oos",
          availability: "out_of_stock",
        },
      ],
    );
    expect(xml).toMatch(/<g:availability>out_of_stock<\/g:availability>/);
  });
});
