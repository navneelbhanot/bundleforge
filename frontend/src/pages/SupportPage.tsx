/**
 * Support page (M-187) at `/support`.
 *
 * Discoverable home for merchant help. Combines:
 *  - Browse + search the 9 markdown articles from
 *    `/api/v1/help/articles` (same data the HelpDrawer uses)
 *  - "Talk to us" card with Crisp chat trigger (if loaded) +
 *    email mailto fallback
 *  - "Resources" card with optional external links (changelog,
 *    status page, GitHub issues) — each shown only when its env
 *    var is set, so dev with no env shows nothing dead
 *
 * The HelpDrawer keeps working unchanged from ⌘K and `?` —
 * SupportPage is the "browse" mode; the drawer is the "quick
 * lookup" mode.
 */
import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import {
  BlockStack,
  Box,
  Button,
  Card,
  Frame,
  Grid,
  Page,
  Text,
  TextField,
} from "@shopify/polaris";

import { MarkdownView } from "../components/help/MarkdownView";

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

const SUPPORT_EMAIL =
  (import.meta.env?.VITE_SUPPORT_EMAIL as string | undefined) ??
  "support@bundleforge.app";
const STATUS_URL = import.meta.env?.VITE_STATUS_URL as string | undefined;
const GITHUB_REPO_URL = import.meta.env?.VITE_GITHUB_REPO_URL as
  | string
  | undefined;
const CHANGELOG_URL = import.meta.env?.VITE_CHANGELOG_URL as
  | string
  | undefined;

interface CrispWindow {
  $crisp?: { push: (cmd: unknown[]) => void };
}

/**
 * Poll for `window.$crisp` for up to 3s (Crisp loads async).
 * Returns whether the chat is ready to be opened.
 */
function useCrispReady(): boolean {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    if ((window as unknown as CrispWindow).$crisp) {
      setReady(true);
      return;
    }
    const start = Date.now();
    const timer = window.setInterval(() => {
      if ((window as unknown as CrispWindow).$crisp) {
        setReady(true);
        window.clearInterval(timer);
        return;
      }
      if (Date.now() - start > 3000) {
        window.clearInterval(timer);
      }
    }, 250);
    return () => window.clearInterval(timer);
  }, []);
  return ready;
}

function openCrispChat(): void {
  if (typeof window === "undefined") return;
  const crisp = (window as unknown as CrispWindow).$crisp;
  crisp?.push(["do", "chat:open"]);
}

export interface SupportPageProps {
  fetcher?: FetcherShape;
}

export function SupportPage(props: SupportPageProps = {}): JSX.Element {
  const { fetcher = defaultFetcher } = props;
  const navigate = useNavigate();
  const location = useLocation();
  const [articles, setArticles] = useState<ArticleMeta[]>([]);
  const [active, setActive] = useState<ArticleFull | null>(null);
  const [bodyCache, setBodyCache] = useState<Record<string, ArticleFull>>({});
  const [filter, setFilter] = useState("");
  const [listError, setListError] = useState<string | null>(null);
  const [bodyError, setBodyError] = useState<string | null>(null);
  const crispReady = useCrispReady();

  // Load article list on mount.
  useEffect(() => {
    fetcher
      .list()
      .then((res) => setArticles(res.data))
      .catch((e: Error) => setListError(e.message));
  }, [fetcher]);

  // Hash-routed selection. URL shape: /support#bundle-types.
  useEffect(() => {
    const hash = location.hash.replace(/^#/, "");
    if (!hash || articles.length === 0) {
      // No hash and no current article — auto-select the first
      // article in the list so the page is never blank.
      if (articles.length > 0 && !active && !hash) {
        const first = articles[0];
        if (bodyCache[first.id]) {
          setActive(bodyCache[first.id]);
        } else {
          fetcher
            .get(first.id)
            .then((full) => {
              setActive(full);
              setBodyCache((prev) => ({ ...prev, [first.id]: full }));
            })
            .catch((e: Error) => setBodyError(e.message));
        }
      }
      return;
    }
    if (active?.id === hash) return;
    if (bodyCache[hash]) {
      setActive(bodyCache[hash]);
      setBodyError(null);
      return;
    }
    fetcher
      .get(hash)
      .then((full) => {
        setActive(full);
        setBodyCache((prev) => ({ ...prev, [hash]: full }));
        setBodyError(null);
      })
      .catch((e: Error) => setBodyError(e.message));
  }, [location.hash, articles, active, bodyCache, fetcher]);

  function selectArticle(id: string): void {
    navigate(`/support#${id}`, { replace: false });
  }

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return articles;
    return articles.filter((a) => a.title.toLowerCase().includes(q));
  }, [articles, filter]);

  // Group filtered articles by category for the list pane.
  const grouped = useMemo(() => {
    const map = new Map<string, ArticleMeta[]>();
    for (const a of filtered) {
      const list = map.get(a.category) ?? [];
      list.push(a);
      map.set(a.category, list);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [filtered]);

  return (
    <Frame>
      <Page
        title="Support"
        subtitle="Browse our help library, message us, or open a chat. Average response under one business day."
      >
        <BlockStack gap="500">
          <TextField
            autoComplete="off"
            label="Search articles"
            labelHidden
            placeholder="Search help articles…"
            value={filter}
            onChange={setFilter}
            clearButton
            onClearButtonClick={() => setFilter("")}
          />

          <Grid>
            {/* Left pane — Talk-to-us, Resources, and the article list */}
            <Grid.Cell columnSpan={{ xs: 6, sm: 6, md: 2, lg: 4, xl: 4 }}>
              <BlockStack gap="400">
                {/* Talk to us — persistent CTA, always visible */}
                <Card>
                  <BlockStack gap="300">
                    <Text as="h2" variant="headingSm">
                      Talk to us
                    </Text>
                    <Text as="p" tone="subdued" variant="bodySm">
                      Average response under one business day. If your
                      issue is on a live order, mention the order
                      number so we can find it fast.
                    </Text>
                    <BlockStack gap="200">
                      {crispReady ? (
                        <Button
                          variant="primary"
                          fullWidth
                          onClick={openCrispChat}
                        >
                          Open live chat
                        </Button>
                      ) : null}
                      <Button
                        variant={crispReady ? "secondary" : "primary"}
                        fullWidth
                        url={`mailto:${SUPPORT_EMAIL}?subject=BundleForge%20support%20request`}
                        external
                      >
                        Email support
                      </Button>
                    </BlockStack>
                  </BlockStack>
                </Card>

                {/* Resources — only renders the rows whose env vars are set */}
                {CHANGELOG_URL || STATUS_URL || GITHUB_REPO_URL ? (
                  <Card>
                    <BlockStack gap="200">
                      <Text as="h2" variant="headingSm">
                        Resources
                      </Text>
                      <BlockStack gap="100">
                        {CHANGELOG_URL ? (
                          <Button
                            url={CHANGELOG_URL}
                            external
                            variant="plain"
                          >
                            Changelog →
                          </Button>
                        ) : null}
                        {STATUS_URL ? (
                          <Button url={STATUS_URL} external variant="plain">
                            System status →
                          </Button>
                        ) : null}
                        {GITHUB_REPO_URL ? (
                          <Button
                            url={GITHUB_REPO_URL}
                            external
                            variant="plain"
                          >
                            Report an issue on GitHub →
                          </Button>
                        ) : null}
                      </BlockStack>
                    </BlockStack>
                  </Card>
                ) : null}

                {/* Article list */}
                <Card>
                  <BlockStack gap="300">
                    <Text as="h2" variant="headingSm">
                      {filter
                        ? `${filtered.length} article${filtered.length === 1 ? "" : "s"}`
                        : `${articles.length} article${articles.length === 1 ? "" : "s"}`}
                    </Text>
                    {listError ? (
                      <Text as="p" tone="critical">
                        Couldn&apos;t load: {listError}
                      </Text>
                    ) : grouped.length === 0 ? (
                      <Text as="p" tone="subdued">
                        {articles.length === 0 ? "Loading…" : "No matches."}
                      </Text>
                    ) : (
                      grouped.map(([category, list]) => (
                        <BlockStack key={category} gap="100">
                          <Text as="h3" variant="bodySm" tone="subdued">
                            {category}
                          </Text>
                          <BlockStack gap="050">
                            {list.map((a) => (
                              <button
                                key={a.id}
                                type="button"
                                onClick={() => selectArticle(a.id)}
                                style={{
                                  display: "block",
                                  width: "100%",
                                  padding: "6px 8px",
                                  border: "none",
                                  borderRadius: 6,
                                  cursor: "pointer",
                                  textAlign: "left",
                                  background:
                                    active?.id === a.id
                                      ? "var(--p-color-bg-surface-selected)"
                                      : "transparent",
                                  color:
                                    active?.id === a.id
                                      ? "var(--p-color-text-emphasis)"
                                      : "var(--p-color-text)",
                                  fontWeight: active?.id === a.id ? 600 : 400,
                                }}
                              >
                                {a.title}
                              </button>
                            ))}
                          </BlockStack>
                        </BlockStack>
                      ))
                    )}
                  </BlockStack>
                </Card>
              </BlockStack>
            </Grid.Cell>

            {/* Right pane — selected article */}
            <Grid.Cell columnSpan={{ xs: 6, sm: 6, md: 4, lg: 8, xl: 8 }}>
              <Card>
                <Box padding="200">
                  {bodyError ? (
                    <Text as="p" tone="critical">
                      Couldn&apos;t load article: {bodyError}
                    </Text>
                  ) : !active ? (
                    <Text as="p" tone="subdued">
                      Pick an article from the list.
                    </Text>
                  ) : (
                    <MarkdownView body={active.body} />
                  )}
                </Box>
              </Card>
            </Grid.Cell>
          </Grid>
        </BlockStack>
      </Page>
    </Frame>
  );
}
