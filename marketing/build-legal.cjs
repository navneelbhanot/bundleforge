#!/usr/bin/env node
// Render legal/privacy-policy.md and legal/terms-of-service.md to
// DESIGN.md-styled HTML pages for the marketing site.
//
//   node marketing/build-legal.cjs
//
// Outputs marketing/privacy.html and marketing/terms.html.
//
// Source of truth stays in legal/*.md. Re-run this script whenever
// the markdown changes or the substitutions below are updated.
//
// Substitutions:
// - Filled values are baked from things we already know (effective
//   date, contact emails, hosting vendor).
// - Anything still user-specific (operating_entity,
//   governing_jurisdiction, venue, region, eu_representative,
//   security_url) renders as a styled "[pending: name]" badge so
//   readers can see at a glance what's awaiting counsel review.
//
// The markdown converter is hand-rolled, deliberately small, and
// only handles the subset these two files use — h1/h2/h3,
// paragraphs, blockquotes, ordered + unordered lists, tables,
// inline bold / code / links. Don't extend it speculatively;
// extend it only when a real legal-doc change needs it.

const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const LEGAL_DIR = path.join(ROOT, "legal");
const OUT_DIR = __dirname;

// Today's date as the effective date.
const EFFECTIVE_DATE = new Date().toISOString().slice(0, 10);

const FILLED = {
  effective_date: EFFECTIVE_DATE,
  privacy_email: "privacy@bundleforge.app",
  support_email: "support@bundleforge.app",
  legal_email: "legal@bundleforge.app",
  hosting_vendor: "Railway",
  db_vendor: "Railway (managed Postgres 16)",
  redis_vendor: "Railway (managed Redis 7)",
};

const PENDING = new Set([
  "operating_entity",
  "governing_jurisdiction",
  "venue",
  "region",
  "eu_representative",
  "security_url",
]);

function escapeHtml(s) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function inline(text) {
  // Order matters: code first (don't process markdown inside backticks),
  // then links, then bold.
  let out = "";
  let i = 0;
  while (i < text.length) {
    if (text[i] === "`") {
      const end = text.indexOf("`", i + 1);
      if (end !== -1) {
        out += `<code>${escapeHtml(text.slice(i + 1, end))}</code>`;
        i = end + 1;
        continue;
      }
    }
    if (text[i] === "[") {
      const close = text.indexOf("](", i + 1);
      const paren = close !== -1 ? text.indexOf(")", close + 2) : -1;
      if (close !== -1 && paren !== -1) {
        const label = text.slice(i + 1, close);
        const url = text.slice(close + 2, paren);
        const safeUrl = url.startsWith("javascript:") ? "#" : url;
        out += `<a href="${escapeHtml(safeUrl)}">${escapeHtml(label)}</a>`;
        i = paren + 1;
        continue;
      }
    }
    if (text.startsWith("**", i)) {
      const end = text.indexOf("**", i + 2);
      if (end !== -1) {
        out += `<strong>${escapeHtml(text.slice(i + 2, end))}</strong>`;
        i = end + 2;
        continue;
      }
    }
    out += escapeHtml(text[i]);
    i++;
  }
  return out;
}

function applySubs(raw) {
  return raw.replace(/\{\{([a-z_]+)\}\}/g, (_, key) => {
    if (key in FILLED) return FILLED[key];
    if (PENDING.has(key)) {
      return `<span class="placeholder" title="Pending counsel review">[pending: ${key}]</span>`;
    }
    return `{{${key}}}`;
  });
}

function isTableSeparator(line) {
  return /^\s*\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)+\|?\s*$/.test(line);
}

function splitTableRow(line) {
  const trimmed = line.trim().replace(/^\|/, "").replace(/\|$/, "");
  return trimmed.split("|").map((c) => c.trim());
}

function renderMarkdown(md) {
  // Skip the leading "Template — fill in placeholders" hint; the page
  // renders its own draft banner.
  const lines = md.split("\n").filter((l) => !/^>\s*Template — fill in placeholders/.test(l));

  const out = [];
  let i = 0;

  function closeIfOpen(stack, kind) {
    while (stack.length && stack[stack.length - 1] !== kind) {
      out.push(`</${stack.pop()}>`);
    }
  }

  const listStack = []; // stack of "ul" | "ol"

  function closeAllLists() {
    while (listStack.length) {
      out.push(`</${listStack.pop()}>`);
    }
  }

  while (i < lines.length) {
    const line = lines[i];

    // Blank
    if (/^\s*$/.test(line)) {
      closeAllLists();
      i++;
      continue;
    }

    // Headings
    let m;
    if ((m = line.match(/^(#{1,6})\s+(.+)$/))) {
      closeAllLists();
      const level = m[1].length;
      out.push(`<h${level}>${inline(m[2])}</h${level}>`);
      i++;
      continue;
    }

    // Blockquote (single block)
    if (/^>\s?/.test(line)) {
      closeAllLists();
      const block = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) {
        block.push(lines[i].replace(/^>\s?/, ""));
        i++;
      }
      out.push(`<blockquote>${inline(block.join(" "))}</blockquote>`);
      continue;
    }

    // Table: header row + separator + body
    if (line.includes("|") && i + 1 < lines.length && isTableSeparator(lines[i + 1])) {
      closeAllLists();
      const header = splitTableRow(line);
      i += 2; // skip header + separator
      const rows = [];
      while (i < lines.length && lines[i].includes("|") && lines[i].trim() !== "") {
        rows.push(splitTableRow(lines[i]));
        i++;
      }
      out.push("<table>");
      out.push("<thead><tr>" + header.map((c) => `<th>${inline(c)}</th>`).join("") + "</tr></thead>");
      out.push("<tbody>");
      for (const r of rows) {
        out.push("<tr>" + r.map((c) => `<td>${inline(c)}</td>`).join("") + "</tr>");
      }
      out.push("</tbody></table>");
      continue;
    }

    // Numbered list
    if ((m = line.match(/^\s*(\d+)\.\s+(.+)$/))) {
      if (listStack[listStack.length - 1] !== "ol") {
        closeAllLists();
        listStack.push("ol");
        out.push("<ol>");
      }
      out.push(`<li>${inline(m[2])}</li>`);
      i++;
      continue;
    }

    // Bulleted list
    if ((m = line.match(/^\s*-\s+(.+)$/))) {
      if (listStack[listStack.length - 1] !== "ul") {
        closeAllLists();
        listStack.push("ul");
        out.push("<ul>");
      }
      out.push(`<li>${inline(m[1])}</li>`);
      i++;
      continue;
    }

    // Paragraph: gather consecutive non-blank, non-special lines
    closeAllLists();
    const buf = [line];
    i++;
    while (
      i < lines.length &&
      lines[i].trim() !== "" &&
      !/^#{1,6}\s/.test(lines[i]) &&
      !/^>\s?/.test(lines[i]) &&
      !/^\s*-\s+/.test(lines[i]) &&
      !/^\s*\d+\.\s+/.test(lines[i]) &&
      !(lines[i].includes("|") && i + 1 < lines.length && isTableSeparator(lines[i + 1]))
    ) {
      buf.push(lines[i]);
      i++;
    }
    out.push(`<p>${inline(buf.join(" "))}</p>`);
  }

  closeAllLists();
  return out.join("\n");
}

function pageTemplate({ title, slug, body }) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${escapeHtml(title)} · BundleForge</title>
<meta name="description" content="${escapeHtml(title)} for the BundleForge Shopify app." />
<meta name="theme-color" content="#000000" />
<meta name="robots" content="index,follow" />
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@100..900&display=swap" />
<style>
  :root { color-scheme: dark; }
  *, *::before, *::after { box-sizing: border-box; }
  html, body { background: #000; margin: 0; padding: 0; }
  body {
    font-family: 'Inter', 'Helvetica Neue', system-ui, sans-serif;
    font-feature-settings: 'ss03' on;
    color: #FFFFFF;
    -webkit-font-smoothing: antialiased;
    line-height: 1.56;
  }
  a { color: #99B3AD; text-decoration: underline; text-underline-offset: 4px; text-decoration-color: #3F3F46; transition: color 200ms ease; }
  a:hover { color: #FFFFFF; }
  code { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, monospace; font-size: 0.92em; background: #102620; color: #D4F9E0; padding: 1px 6px; border-radius: 3px; }

  /* Page chrome */
  header.site {
    position: fixed; top: 0; left: 0; right: 0; z-index: 40;
    background: rgba(0,0,0,0.60); backdrop-filter: blur(12px);
    border-bottom: 1px solid rgba(30,44,49,0.60);
    height: 64px; display: flex; align-items: center;
  }
  header.site .inner {
    max-width: 1280px; margin: 0 auto; padding: 0 16px;
    display: flex; justify-content: space-between; align-items: center; width: 100%;
  }
  header.site a.brand {
    display: inline-flex; align-items: center; gap: 12px;
    color: #FFFFFF; text-decoration: none;
    font-size: 18px; letter-spacing: 0.72px;
    font-variation-settings: 'wght' 500;
  }
  header.site .stripe {
    width: 24px; height: 24px; border-radius: 9999px;
    background: linear-gradient(135deg, #36F4A4 0%, #99B3AD 50%, #102620 100%);
    display: inline-block;
  }
  header.site .nav-back {
    color: #A1A1AA; font-size: 16px; text-decoration: none;
    transition: color 200ms ease;
  }
  header.site .nav-back:hover { color: #FFFFFF; }

  main { padding-top: 96px; max-width: 760px; margin: 0 auto; padding-left: 24px; padding-right: 24px; padding-bottom: 96px; }

  .draft-banner {
    margin: 24px 0 48px;
    padding: 16px 20px;
    border: 1px solid rgba(54,244,164,0.30);
    background: rgba(54,244,164,0.05);
    border-radius: 12px;
    color: #D4F9E0;
    font-size: 14px;
    line-height: 1.50;
  }
  .draft-banner strong { color: #36F4A4; font-variation-settings: 'wght' 550; }

  .placeholder {
    display: inline-block;
    padding: 1px 8px;
    border: 1px dashed rgba(54,244,164,0.40);
    border-radius: 4px;
    color: #36F4A4;
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 0.88em;
    letter-spacing: 0.02em;
  }

  /* Typography */
  h1 {
    font-family: 'NeueHaasGrotesk', 'Helvetica Neue', 'Inter', system-ui, sans-serif;
    font-size: clamp(40px, 5.4vw, 64px);
    line-height: 1.05;
    font-variation-settings: 'wght' 330;
    margin: 0 0 16px;
    letter-spacing: -0.5px;
  }
  h2 {
    font-family: 'NeueHaasGrotesk', 'Helvetica Neue', 'Inter', system-ui, sans-serif;
    font-size: 28px;
    line-height: 1.20;
    font-variation-settings: 'wght' 500;
    margin: 56px 0 16px;
    letter-spacing: 0.3px;
  }
  h3 {
    font-family: 'NeueHaasGrotesk', 'Helvetica Neue', 'Inter', system-ui, sans-serif;
    font-size: 20px;
    line-height: 1.30;
    font-variation-settings: 'wght' 550;
    margin: 32px 0 12px;
  }
  p { margin: 0 0 16px; color: #D4D4D8; font-size: 16px; }
  ul, ol { padding-left: 24px; margin: 0 0 20px; color: #D4D4D8; }
  li { margin: 6px 0; }
  strong { color: #FFFFFF; font-variation-settings: 'wght' 550; }
  blockquote {
    margin: 20px 0; padding: 12px 16px;
    border-left: 2px solid #36F4A4;
    background: #02090A; color: #D4D4D8;
    border-radius: 0 8px 8px 0;
  }
  table { width: 100%; border-collapse: collapse; margin: 16px 0 24px; font-size: 14px; }
  th, td { padding: 10px 12px; text-align: left; border-bottom: 1px solid #1E2C31; }
  thead th { color: #FFFFFF; font-variation-settings: 'wght' 550; background: #061A1C; }
  tbody td { color: #D4D4D8; }
  tbody tr:hover td { background: #02090A; }

  .meta { color: #71717A; font-size: 14px; margin: 8px 0 24px; }

  /* Footer */
  footer.site {
    background: #102620; border-top: 1px solid #1E2C31;
    padding: 48px 16px; margin-top: 96px;
    color: #A1A1AA; font-size: 14px;
  }
  footer.site .inner { max-width: 1280px; margin: 0 auto; }
  footer.site a { color: #D4D4D8; text-decoration: none; margin-right: 20px; }
  footer.site a:hover { color: #FFFFFF; }
</style>
</head>
<body>

<header class="site">
  <div class="inner">
    <a href="/" class="brand">
      <span class="stripe"></span>
      <span>BundleForge</span>
    </a>
    <a href="/" class="nav-back">← Back to home</a>
  </div>
</header>

<main>
  <div class="draft-banner">
    <strong>Draft.</strong> This document is published in good faith as a working draft pending counsel review and entity formation. Items shown as <span class="placeholder">[pending: name]</span> are awaiting confirmed values. The effective date below is provisional. The substantive commitments — fair-use clause, GDPR data-export endpoints, immutable audit log, pro-rata refunds — are real and shipped.
  </div>
  ${body}
</main>

<footer class="site">
  <div class="inner">
    <a href="/">Home</a>
    <a href="/privacy">Privacy</a>
    <a href="/terms">Terms</a>
    <a href="mailto:support@bundleforge.app">Contact</a>
    <p class="meta" style="margin-top:24px">© 2026 BundleForge. Not affiliated with Shopify Inc. Shopify is a registered trademark of Shopify Inc.</p>
  </div>
</footer>

</body>
</html>
`;
}

function build(slug, sourceFile, title) {
  const md = fs.readFileSync(path.join(LEGAL_DIR, sourceFile), "utf8");
  const substituted = applySubs(md);
  const body = renderMarkdown(substituted);
  const html = pageTemplate({ title, slug, body });
  const outPath = path.join(OUT_DIR, `${slug}.html`);
  fs.writeFileSync(outPath, html);
  console.log(`wrote ${path.relative(ROOT, outPath)} (${html.length} bytes)`);
}

build("privacy", "privacy-policy.md", "Privacy Policy");
build("terms", "terms-of-service.md", "Terms of Service");
