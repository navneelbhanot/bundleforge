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
 * The markdown renderer was extracted to
 * `components/help/MarkdownView.tsx` in M-187 so the drawer
 * and the new SupportPage share one implementation.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BlockStack,
  Box,
  Card,
  Grid,
  Modal,
  Text,
  TextField,
} from "@shopify/polaris";

import { MarkdownView } from "./help/MarkdownView";

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

