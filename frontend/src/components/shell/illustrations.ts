/**
 * Inline SVG illustrations for empty states (M-183).
 *
 * Each entry is an SVG converted to a `data:image/svg+xml`
 * URI so it can be passed directly to Polaris's `EmptyState`
 * `image` prop. Inline SVG keeps the deploy lean (no asset
 * pipeline, no CDN round-trip), the illustrations sharp at
 * any DPI, and themeable via the embedded fill colors.
 *
 * Style: minimalist line + soft fill, single accent color
 * (Polaris brand-blue-ish #5C6AC4), 240×140 viewBox.
 */
export type IllustrationName =
  | "orders"
  | "analytics"
  | "audit"
  | "inventory"
  | "ai";

const ACCENT = "%235c6ac4"; // url-encoded #5c6ac4
const SOFT = "%23eef0fb";   // url-encoded #eef0fb
const STROKE = "%231f2937"; // url-encoded #1f2937

function svg(body: string): string {
  return `data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 240 140' width='240' height='140'>${body}</svg>`;
}

const ORDERS = svg(
  `<rect x='40' y='50' width='160' height='70' rx='6' fill='${SOFT}' stroke='${ACCENT}' stroke-width='2'/>` +
    `<rect x='60' y='30' width='120' height='30' rx='4' fill='white' stroke='${ACCENT}' stroke-width='2'/>` +
    `<line x1='70' y1='75' x2='170' y2='75' stroke='${ACCENT}' stroke-width='2' stroke-linecap='round'/>` +
    `<line x1='70' y1='90' x2='140' y2='90' stroke='${ACCENT}' stroke-width='2' stroke-linecap='round'/>` +
    `<line x1='70' y1='105' x2='150' y2='105' stroke='${ACCENT}' stroke-width='2' stroke-linecap='round'/>`,
);

const ANALYTICS = svg(
  `<rect x='40' y='30' width='160' height='90' rx='6' fill='${SOFT}' stroke='${ACCENT}' stroke-width='2'/>` +
    `<rect x='60' y='80' width='14' height='30' fill='${ACCENT}'/>` +
    `<rect x='84' y='65' width='14' height='45' fill='${ACCENT}'/>` +
    `<rect x='108' y='50' width='14' height='60' fill='${ACCENT}'/>` +
    `<rect x='132' y='70' width='14' height='40' fill='${ACCENT}'/>` +
    `<rect x='156' y='55' width='14' height='55' fill='${ACCENT}'/>` +
    `<line x1='50' y1='110' x2='190' y2='110' stroke='${STROKE}' stroke-width='1.5'/>`,
);

const AUDIT = svg(
  `<rect x='70' y='25' width='100' height='100' rx='4' fill='white' stroke='${ACCENT}' stroke-width='2'/>` +
    `<line x1='85' y1='45' x2='155' y2='45' stroke='${ACCENT}' stroke-width='2' stroke-linecap='round'/>` +
    `<line x1='85' y1='60' x2='150' y2='60' stroke='${ACCENT}' stroke-width='2' stroke-linecap='round'/>` +
    `<line x1='85' y1='75' x2='140' y2='75' stroke='${ACCENT}' stroke-width='2' stroke-linecap='round'/>` +
    `<line x1='85' y1='90' x2='155' y2='90' stroke='${ACCENT}' stroke-width='2' stroke-linecap='round'/>` +
    `<line x1='85' y1='105' x2='130' y2='105' stroke='${ACCENT}' stroke-width='2' stroke-linecap='round'/>` +
    `<circle cx='180' cy='35' r='12' fill='${ACCENT}'/>` +
    `<path d='M174 35 l4 4 l8 -8' stroke='white' stroke-width='2' fill='none' stroke-linecap='round' stroke-linejoin='round'/>`,
);

const INVENTORY = svg(
  `<rect x='30' y='80' width='50' height='40' rx='3' fill='${SOFT}' stroke='${ACCENT}' stroke-width='2'/>` +
    `<rect x='95' y='60' width='50' height='60' rx='3' fill='${SOFT}' stroke='${ACCENT}' stroke-width='2'/>` +
    `<rect x='160' y='40' width='50' height='80' rx='3' fill='${SOFT}' stroke='${ACCENT}' stroke-width='2'/>` +
    `<line x1='30' y1='80' x2='80' y2='80' stroke='${ACCENT}' stroke-width='2'/>` +
    `<line x1='95' y1='60' x2='145' y2='60' stroke='${ACCENT}' stroke-width='2'/>` +
    `<line x1='160' y1='40' x2='210' y2='40' stroke='${ACCENT}' stroke-width='2'/>`,
);

const AI = svg(
  `<circle cx='120' cy='75' r='35' fill='${SOFT}' stroke='${ACCENT}' stroke-width='2'/>` +
    `<path d='M120 50 l5 13 l13 5 l-13 5 l-5 13 l-5 -13 l-13 -5 l13 -5 z' fill='${ACCENT}'/>` +
    `<path d='M170 35 l3 7 l7 3 l-7 3 l-3 7 l-3 -7 l-7 -3 l7 -3 z' fill='${ACCENT}'/>` +
    `<path d='M65 95 l2.5 6 l6 2.5 l-6 2.5 l-2.5 6 l-2.5 -6 l-6 -2.5 l6 -2.5 z' fill='${ACCENT}'/>`,
);

export const ILLUSTRATIONS: Record<IllustrationName, string> = {
  orders: ORDERS,
  analytics: ANALYTICS,
  audit: AUDIT,
  inventory: INVENTORY,
  ai: AI,
};

export function getIllustration(name?: IllustrationName): string {
  if (!name) return "";
  return ILLUSTRATIONS[name] ?? "";
}
