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
  | { kind: "list"; ordered: boolean; items: string[] };

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
        return (
          <Text as="p" key={i} variant="bodyMd">
            {renderInline(tokenizeInline(b.text))}
          </Text>
        );
      })}
    </BlockStack>
  );
}
