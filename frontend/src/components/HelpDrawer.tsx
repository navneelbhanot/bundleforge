/**
 * In-app help drawer (M-181).
 *
 * Polaris Modal that surfaces `docs/help/*.md` inside the
 * admin. Two-column layout: article list (with search) on the
 * left, rendered markdown on the right. Mounted globally in
 * App shell; opened by `?` hotkey or the Open-help action in
 * the ⌘K command palette (cross-component pub/sub via a
 * window CustomEvent).
 *
 * Includes a tiny self-contained markdown renderer because
 * the project doesn't ship a markdown library. The renderer
 * handles headings, paragraphs, lists, code blocks, and a
 * small set of inline formatting (bold / code / links).
 * `javascript:` URIs in [text](url) are rendered as plain
 * text — security hardening since article content is
 * controlled today but this lets the surface stay safe if
 * we later let merchants supply their own help articles.
 */
import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  BlockStack,
  Box,
  Card,
  Grid,
  Modal,
  Text,
  TextField,
} from "@shopify/polaris";

export const OPEN_HELP_EVENT = "bundleforge:open-help";

interface ArticleMeta {
  id: string;
  title: string;
  category: string;
}

interface ArticleFull extends ArticleMeta {
  body: string;
}

interface FetcherShape {
  list: () => Promise<{ data: ArticleMeta[] }>;
  get: (id: string) => Promise<ArticleFull>;
}

const defaultFetcher: FetcherShape = {
  list: () =>
    fetch("/api/v1/help/articles").then((r) => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json() as Promise<{ data: ArticleMeta[] }>;
    }),
  get: (id) =>
    fetch(`/api/v1/help/articles/${id}`).then((r) => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json() as Promise<ArticleFull>;
    }),
};

export interface HelpDrawerProps {
  /** DI seam for tests. */
  fetcher?: FetcherShape;
  /** Test-only: open from the start. */
  initialOpen?: boolean;
}

function isInsideTextField(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  const tag = el.tagName.toLowerCase();
  if (tag === "input" || tag === "textarea") return true;
  if (el.isContentEditable) return true;
  return false;
}

export function HelpDrawer(props: HelpDrawerProps): JSX.Element {
  const { fetcher = defaultFetcher, initialOpen = false } = props;
  const [open, setOpen] = useState(initialOpen);
  const [articles, setArticles] = useState<ArticleMeta[]>([]);
  const [active, setActive] = useState<ArticleFull | null>(null);
  const [bodyCache, setBodyCache] = useState<Record<string, ArticleFull>>(
    {},
  );
  const [filter, setFilter] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Lazy-load article list on first open.
  useEffect(() => {
    if (!open) return;
    if (articles.length > 0) return;
    fetcher
      .list()
      .then((res) => setArticles(res.data))
      .catch((e: Error) => setError(e.message));
  }, [open, articles.length, fetcher]);

  // Hotkeys + custom-event listener. ? opens the drawer when
  // not inside an input. Custom event fired by the ⌘K palette's
  // "Open help" action also opens the drawer.
  useEffect(() => {
    function onKey(e: KeyboardEvent): void {
      if (e.key !== "?") return;
      if (isInsideTextField(e.target)) return;
      e.preventDefault();
      setOpen(true);
    }
    function onOpenEvent(): void {
      setOpen(true);
    }
    window.addEventListener("keydown", onKey);
    window.addEventListener(OPEN_HELP_EVENT, onOpenEvent);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener(OPEN_HELP_EVENT, onOpenEvent);
    };
  }, []);

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return articles;
    return articles.filter((a) =>
      a.title.toLowerCase().includes(q),
    );
  }, [articles, filter]);

  const grouped = useMemo(() => {
    const map = new Map<string, ArticleMeta[]>();
    for (const a of filtered) {
      const list = map.get(a.category) ?? [];
      list.push(a);
      map.set(a.category, list);
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [filtered]);

  const handleSelect = useCallback(
    async (id: string): Promise<void> => {
      if (bodyCache[id]) {
        setActive(bodyCache[id]);
        return;
      }
      try {
        const full = await fetcher.get(id);
        setBodyCache((c) => ({ ...c, [id]: full }));
        setActive(full);
      } catch (e) {
        setError((e as Error).message);
      }
    },
    [bodyCache, fetcher],
  );

  return (
    <Modal
      open={open}
      onClose={() => setOpen(false)}
      title="Help"
      size="large"
    >
      <Modal.Section>
        <Grid>
          <Grid.Cell columnSpan={{ xs: 6, sm: 6, md: 2, lg: 2, xl: 2 }}>
            <BlockStack gap="300">
              <TextField
                label="Search articles"
                labelHidden
                value={filter}
                onChange={setFilter}
                autoComplete="off"
                placeholder="Search articles…"
              />
              {error && (
                <Text as="p" tone="critical">
                  {error}
                </Text>
              )}
              {grouped.length === 0 && articles.length === 0 && (
                <Text as="p" tone="subdued">
                  Loading articles…
                </Text>
              )}
              {grouped.length === 0 && articles.length > 0 && (
                <Text as="p" tone="subdued">
                  No articles match.
                </Text>
              )}
              {grouped.map(([cat, list]) => (
                <BlockStack gap="100" key={cat}>
                  <Text as="p" variant="bodySm" tone="subdued">
                    {cat}
                  </Text>
                  {list.map((a) => {
                    const selected = active?.id === a.id;
                    return (
                      <Box
                        key={a.id}
                        padding="200"
                        borderRadius="200"
                        background={
                          selected
                            ? "bg-surface-selected"
                            : "bg-surface-secondary"
                        }
                      >
                        <button
                          type="button"
                          onClick={() => handleSelect(a.id)}
                          style={{
                            width: "100%",
                            textAlign: "left",
                            background: "transparent",
                            border: "none",
                            padding: 0,
                            cursor: "pointer",
                          }}
                        >
                          <Text as="span" fontWeight="semibold">
                            {a.title}
                          </Text>
                        </button>
                      </Box>
                    );
                  })}
                </BlockStack>
              ))}
            </BlockStack>
          </Grid.Cell>
          <Grid.Cell columnSpan={{ xs: 6, sm: 6, md: 4, lg: 4, xl: 4 }}>
            {active === null ? (
              <Card>
                <Text as="p" tone="subdued">
                  Pick an article on the left to read it here.
                </Text>
              </Card>
            ) : (
              <Card>
                <BlockStack gap="200">
                  <MarkdownView body={active.body} />
                </BlockStack>
              </Card>
            )}
          </Grid.Cell>
        </Grid>
      </Modal.Section>
    </Modal>
  );
}

// ---------------- Tiny markdown renderer ----------------

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
      return (
        <strong key={i}>{t.text}</strong>
      );
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
        <a
          key={i}
          href={t.href}
          target="_blank"
          rel="noopener noreferrer"
        >
          {t.text}
        </a>
      );
    }
    return (
      <Fragment key={i}>{t.text}</Fragment>
    );
  });
}

interface MarkdownViewProps {
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
