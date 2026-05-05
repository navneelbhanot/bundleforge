/**
 * Google Merchant feed (M-122).
 *
 * Generates an Atom XML feed of bundles in Google Shopping format.
 * Each active bundle is one `<entry>` with `g:id`, `g:title`,
 * `g:price`, `g:availability`, etc.
 */
export interface FeedBundle {
  slug: string;
  title: string;
  description: string | null;
  imageUrl?: string | null;
  priceUsd: number;
  url: string;
  availability?: "in_stock" | "out_of_stock";
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export function buildGoogleMerchantFeed(
  shopName: string,
  bundles: FeedBundle[],
  now: Date = new Date(),
): string {
  const updated = now.toISOString();
  const entries = bundles
    .map((b) => {
      const availability = b.availability ?? "in_stock";
      const desc = b.description ?? b.title;
      const lines = [
        "  <entry>",
        `    <g:id>${escapeXml(b.slug)}</g:id>`,
        `    <g:title>${escapeXml(b.title)}</g:title>`,
        `    <g:description>${escapeXml(desc)}</g:description>`,
        `    <link>${escapeXml(b.url)}</link>`,
        `    <g:price>${b.priceUsd.toFixed(2)} USD</g:price>`,
        `    <g:availability>${availability}</g:availability>`,
        `    <g:condition>new</g:condition>`,
      ];
      if (b.imageUrl) {
        lines.push(`    <g:image_link>${escapeXml(b.imageUrl)}</g:image_link>`);
      }
      lines.push("  </entry>");
      return lines.join("\n");
    })
    .join("\n");
  return [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<feed xmlns="http://www.w3.org/2005/Atom" xmlns:g="http://base.google.com/ns/1.0">`,
    `  <title>${escapeXml(shopName)} — Bundles</title>`,
    `  <updated>${updated}</updated>`,
    entries,
    `</feed>`,
  ].join("\n");
}
