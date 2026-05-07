/**
 * Tiny self-contained markdown renderer (extracted from
 * HelpDrawer in M-187 so SupportPage and the drawer share one
 * implementation).
 *
 * Handles headings, paragraphs, lists, code blocks, and a small
 * set of inline formatting (bold / code / links). `javascript:`
 * URIs in [text](url) are rendered as plain text — security
 * hardening since article content is controlled today but this
 * lets the surface stay safe if we later let merchants supply
 * their own help articles.
 */
import { Fragment, useMemo } from "react";
import { BlockStack, Text } from "@shopify/polaris";

interface InlineToken {
  kind: "text" | "bold" | "code" | "link";
  text: string;
  href?: string;
}

function isSafeUrl(url: string): boolean {
  return /^https?:\/\//i.test(url) || url.startsWith("/") || url.startsWith("#");
}

function tokenizeInline(line: string): InlineToken[] {
  const out: InlineToken[] = [];
  let i = 0;
  let buf = "";
  function flushText(): void {
    if (buf.length > 0) {
      out.push({ kind: "text", text: buf });
      buf = "";
    }
  }
  while (i < line.length) {
    if (line[i] === "*" && line[i + 1] === "*") {
      const end = line.indexOf("**", i + 2);
      if (end > i + 2) {
        flushText();
        out.push({ kind: "bold", text: line.slice(i + 2, end) });
        i = end + 2;
        continue;
      }
    }
    if (line[i] === "`") {
      const end = line.indexOf("`", i + 1);
      if (end > i) {
        flushText();
        out.push({ kind: "code", text: line.slice(i + 1, end) });
        i = end + 1;
        continue;
      }
    }
    if (line[i] === "[") {
      const close = line.indexOf("]", i + 1);
      if (close > i && line[close + 1] === "(") {
        const urlEnd = line.indexOf(")", close + 2);
        if (urlEnd > close + 1) {
          const text = line.slice(i + 1, close);
          const url = line.slice(close + 2, urlEnd);
          flushText();
          if (isSafeUrl(url)) {
            out.push({ kind: "link", text, href: url });
          } else {
            // Render as plain text — drops javascript:, data:, etc.
            out.push({ kind: "text", text });
          }
          i = urlEnd + 1;
          continue;
        }
      }
    }
    buf += line[i];
    i += 1;
  }
  flushText();
  return out;
}

function renderInline(tokens: InlineToken[]): JSX.Element[] {
  return tokens.map((t, i) => {
    if (t.kind === "bold") {
      return <strong key={i}>{t.text}</strong>;
    }
    if (t.kind === "code") {
      return (
        <code
          key={i}
          style={{
            background: "var(--p-color-bg-surface-secondary)",
            padding: "1px 4px",
            borderRadius: 4,
            fontFamily: "ui-monospace, Menlo, monospace",
            fontSize: "0.95em",
          }}
        >
          {t.text}
        </code>
      );
    }
    if (t.kind === "link" && t.href) {
      return (
        <a key={i} href={t.href} target="_blank" rel="noopener noreferrer">
          {t.text}
        </a>
      );
    }
    return <Fragment key={i}>{t.text}</Fragment>;
  });
}

type Block =
  | { kind: "heading"; level: 1 | 2 | 3; text: string }
  | { kind: "paragraph"; text: string }
  | { kind: "code"; text: string }
  | { kind: "list"; ordered: boolean; items: string[] }
  | { kind: "blockquote"; text: string }
  | { kind: "hr" }
  | { kind: "table"; header: string[]; rows: string[][] };

/**
 * GFM table separator row — `|---|---|---|` (with optional
 * alignment colons that we ignore for v1). Returns the column
 * count if the line is a valid separator, else null.
 */
function tableSeparatorCols(line: string): number | null {
  const trimmed = line.trim();
  if (!trimmed.startsWith("|") || !trimmed.endsWith("|")) return null;
  const cells = trimmed.slice(1, -1).split("|");
  if (cells.length === 0) return null;
  for (const cell of cells) {
    if (!/^\s*:?-{1,}:?\s*$/.test(cell)) return null;
  }
  return cells.length;
}

function splitTableRow(line: string): string[] {
  const trimmed = line.trim();
  if (!trimmed.startsWith("|") || !trimmed.endsWith("|")) return [];
  return trimmed
    .slice(1, -1)
    .split("|")
    .map((c) => c.trim());
}

function parseBlocks(body: string): Block[] {
  const lines = body.split("\n");
  const blocks: Block[] = [];
  let i = 0;
  let buf: string[] = [];
  function flushParagraph(): void {
    if (buf.length === 0) return;
    blocks.push({ kind: "paragraph", text: buf.join(" ").trim() });
    buf = [];
  }
  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();
    // Fenced code.
    if (/^```/.test(trimmed)) {
      flushParagraph();
      const codeLines: string[] = [];
      i += 1;
      while (i < lines.length && !/^```/.test(lines[i].trim())) {
        codeLines.push(lines[i]);
        i += 1;
      }
      i += 1; // skip closing fence
      blocks.push({ kind: "code", text: codeLines.join("\n") });
      continue;
    }
    // Heading.
    const heading = /^(#{1,3})\s+(.+)$/.exec(trimmed);
    if (heading) {
      flushParagraph();
      blocks.push({
        kind: "heading",
        level: heading[1].length as 1 | 2 | 3,
        text: heading[2].trim(),
      });
      i += 1;
      continue;
    }
    // Horizontal rule (--- or *** or ___ on its own line).
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
      flushParagraph();
      blocks.push({ kind: "hr" });
      i += 1;
      continue;
    }
    // GFM table — header row, then a separator row of dashes,
    // then zero or more body rows. We require at least one body
    // row to avoid mistaking unrelated `| ... |` lines for tables.
    if (
      trimmed.startsWith("|") &&
      trimmed.endsWith("|") &&
      i + 1 < lines.length &&
      tableSeparatorCols(lines[i + 1]) !== null
    ) {
      flushParagraph();
      const header = splitTableRow(lines[i]);
      const colCount = header.length;
      i += 2; // skip the header + separator row
      const rows: string[][] = [];
      while (i < lines.length) {
        const t = lines[i].trim();
        if (!t.startsWith("|") || !t.endsWith("|")) break;
        const cells = splitTableRow(lines[i]);
        // Pad / truncate to header length so the row count is stable.
        if (cells.length < colCount) {
          while (cells.length < colCount) cells.push("");
        } else if (cells.length > colCount) {
          cells.length = colCount;
        }
        rows.push(cells);
        i += 1;
      }
      blocks.push({ kind: "table", header, rows });
      continue;
    }
    // Blockquote (consume contiguous `> ` lines).
    if (/^>\s?/.test(trimmed)) {
      flushParagraph();
      const quoteLines: string[] = [];
      while (i < lines.length && /^>\s?/.test(lines[i].trim())) {
        quoteLines.push(lines[i].trim().replace(/^>\s?/, ""));
        i += 1;
      }
      blocks.push({ kind: "blockquote", text: quoteLines.join(" ").trim() });
      continue;
    }
    // Lists (consume contiguous list lines).
    if (/^(-|\*)\s+/.test(trimmed) || /^\d+\.\s+/.test(trimmed)) {
      flushParagraph();
      const ordered = /^\d+\.\s+/.test(trimmed);
      const items: string[] = [];
      while (i < lines.length) {
        const t = lines[i].trim();
        if (ordered && /^\d+\.\s+/.test(t)) {
          items.push(t.replace(/^\d+\.\s+/, ""));
        } else if (!ordered && /^(-|\*)\s+/.test(t)) {
          items.push(t.replace(/^(-|\*)\s+/, ""));
        } else {
          break;
        }
        i += 1;
      }
      blocks.push({ kind: "list", ordered, items });
      continue;
    }
    // Blank line ends a paragraph.
    if (trimmed.length === 0) {
      flushParagraph();
      i += 1;
      continue;
    }
    // Otherwise accumulate into the current paragraph.
    buf.push(trimmed);
    i += 1;
  }
  flushParagraph();
  return blocks;
}

export interface MarkdownViewProps {
  body: string;
}

export function MarkdownView({ body }: MarkdownViewProps): JSX.Element {
  const blocks = useMemo(() => parseBlocks(body), [body]);
  return (
    <BlockStack gap="200">
      {blocks.map((b, i) => {
        if (b.kind === "heading") {
          if (b.level === 1) {
            return (
              <Text as="h2" variant="headingLg" key={i}>
                {renderInline(tokenizeInline(b.text))}
              </Text>
            );
          }
          if (b.level === 2) {
            return (
              <Text as="h3" variant="headingMd" key={i}>
                {renderInline(tokenizeInline(b.text))}
              </Text>
            );
          }
          return (
            <Text as="h4" variant="headingSm" key={i}>
              {renderInline(tokenizeInline(b.text))}
            </Text>
          );
        }
        if (b.kind === "code") {
          return (
            <pre
              key={i}
              style={{
                background: "var(--p-color-bg-surface-secondary)",
                padding: "12px",
                borderRadius: 8,
                overflowX: "auto",
                fontFamily: "ui-monospace, Menlo, monospace",
                fontSize: "12px",
                margin: 0,
              }}
            >
              {b.text}
            </pre>
          );
        }
        if (b.kind === "list") {
          const ListTag = b.ordered ? "ol" : "ul";
          return (
            <ListTag key={i} style={{ paddingLeft: 20, margin: 0 }}>
              {b.items.map((item, j) => (
                <li key={j}>
                  <Text as="span" variant="bodyMd">
                    {renderInline(tokenizeInline(item))}
                  </Text>
                </li>
              ))}
            </ListTag>
          );
        }
        if (b.kind === "hr") {
          return (
            <hr
              key={i}
              style={{
                border: 0,
                borderTop: "1px solid var(--p-color-border)",
                margin: "8px 0",
              }}
            />
          );
        }
        if (b.kind === "blockquote") {
          return (
            <blockquote
              key={i}
              style={{
                margin: 0,
                padding: "8px 12px",
                borderLeft:
                  "3px solid var(--p-color-border-emphasis)",
                background: "var(--p-color-bg-surface-secondary)",
                borderRadius: 4,
              }}
            >
              <Text as="p" variant="bodyMd" tone="subdued">
                {renderInline(tokenizeInline(b.text))}
              </Text>
            </blockquote>
          );
        }
        if (b.kind === "table") {
          return (
            <div key={i} style={{ overflowX: "auto" }}>
              <table
                style={{
                  borderCollapse: "collapse",
                  width: "100%",
                  fontSize: 14,
                }}
              >
                <thead>
                  <tr>
                    {b.header.map((cell, j) => (
                      <th
                        key={j}
                        style={{
                          textAlign: "left",
                          padding: "8px 10px",
                          background:
                            "var(--p-color-bg-surface-secondary)",
                          borderBottom:
                            "1px solid var(--p-color-border)",
                          fontWeight: 600,
                        }}
                      >
                        {renderInline(tokenizeInline(cell))}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {b.rows.map((row, ri) => (
                    <tr key={ri}>
                      {row.map((cell, ci) => (
                        <td
                          key={ci}
                          style={{
                            padding: "8px 10px",
                            borderBottom:
                              "1px solid var(--p-color-border)",
                            verticalAlign: "top",
                          }}
                        >
                          {renderInline(tokenizeInline(cell))}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        }
        // Paragraph fall-through.
        return (
          <Text as="p" key={i} variant="bodyMd">
            {renderInline(tokenizeInline(b.text))}
          </Text>
        );
      })}
    </BlockStack>
  );
}
