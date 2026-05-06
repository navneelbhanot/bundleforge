/**
 * Global ⌘K command palette (M-180).
 *
 * Modal triggered by ⌘K (Mac) / Ctrl-K (Win/Linux) that lets
 * the merchant jump anywhere in the admin without leaving the
 * keyboard. Three sections:
 *  - Bundles    — debounced search against /api/v1/bundles.
 *  - Pages      — static list of admin routes.
 *  - Actions    — static list of common actions (Create bundle,
 *                 Browse templates).
 *
 * Mounts once in the App shell and self-manages its open state
 * via a global keydown listener; pages don't need to know the
 * palette exists.
 */
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useNavigate } from "react-router-dom";
import {
  BlockStack,
  Box,
  InlineStack,
  Modal,
  Text,
  TextField,
} from "@shopify/polaris";

interface PageEntry {
  id: string;
  label: string;
  path: string;
}

interface ActionEntry {
  id: string;
  label: string;
  /** Either a path (navigate) or a custom run() handler. */
  path?: string;
  run?: () => void;
}

interface BundleHit {
  id: string;
  title: string;
  type: string;
}

const PAGES: PageEntry[] = [
  { id: "bundles", label: "Bundles", path: "/" },
  { id: "orders", label: "Orders", path: "/orders" },
  { id: "inventory", label: "Inventory", path: "/inventory" },
  { id: "audit", label: "Inventory audit", path: "/inventory/audit" },
  { id: "analytics", label: "Analytics", path: "/analytics" },
  { id: "ai", label: "AI suggestions", path: "/ai-suggestions" },
  { id: "abtests", label: "A/B tests", path: "/ab-tests" },
  { id: "settings", label: "Settings", path: "/settings" },
  { id: "billing", label: "Billing", path: "/billing" },
];

function isMac(): boolean {
  if (typeof navigator === "undefined") return false;
  return /mac|iphone|ipad|ipod/i.test(navigator.userAgent);
}

function isInsideTextField(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  const tag = el.tagName.toLowerCase();
  if (tag === "input" || tag === "textarea") return true;
  if (el.isContentEditable) return true;
  return false;
}

interface FetcherShape {
  (path: string): Promise<{ data: BundleHit[] }>;
}

function defaultFetcher(path: string): Promise<{ data: BundleHit[] }> {
  return fetch(path).then((r) => {
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json() as Promise<{ data: BundleHit[] }>;
  });
}

export interface CommandPaletteProps {
  /** DI seam for tests. Defaults to `fetch`. */
  fetcher?: FetcherShape;
  /**
   * Test-only: force the palette open from the start. Production
   * code keeps it closed and lets the global hotkey toggle it.
   */
  initialOpen?: boolean;
}

export function CommandPalette(props: CommandPaletteProps): JSX.Element {
  const { fetcher = defaultFetcher, initialOpen = false } = props;
  const navigate = useNavigate();
  const [open, setOpen] = useState(initialOpen);
  const [query, setQuery] = useState("");
  const [bundles, setBundles] = useState<BundleHit[]>([]);
  const [highlight, setHighlight] = useState(0);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Action list. Browse templates is special — it triggers a
  // navigation to the bundles list with a query param the page
  // reads on mount; that way it works from any route.
  const actions: ActionEntry[] = useMemo(
    () => [
      { id: "create-bundle", label: "Create bundle", path: "/bundles/new" },
      {
        id: "browse-templates",
        label: "Browse templates",
        path: "/?openTemplates=1",
      },
    ],
    [],
  );

  const filteredPages = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return PAGES;
    return PAGES.filter((p) => p.label.toLowerCase().includes(q));
  }, [query]);

  const filteredActions = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return actions;
    return actions.filter((a) => a.label.toLowerCase().includes(q));
  }, [actions, query]);

  // Debounced bundle search. Empty query → no API hit, no
  // entries.
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const q = query.trim();
    if (!open || q.length === 0) {
      setBundles([]);
      return () => undefined;
    }
    debounceRef.current = setTimeout(() => {
      fetcher(
        `/api/v1/bundles?search=${encodeURIComponent(q)}&limit=10`,
      )
        .then((body) => setBundles(body.data ?? []))
        .catch(() => setBundles([]));
    }, 250);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [open, query, fetcher]);

  // Flat list for keyboard nav. Order matches the rendered
  // sections so highlight indices line up with what the user
  // sees.
  const flat = useMemo(() => {
    const items: Array<
      | { kind: "bundle"; hit: BundleHit }
      | { kind: "page"; page: PageEntry }
      | { kind: "action"; action: ActionEntry }
    > = [];
    for (const hit of bundles) items.push({ kind: "bundle", hit });
    for (const page of filteredPages) items.push({ kind: "page", page });
    for (const action of filteredActions) items.push({ kind: "action", action });
    return items;
  }, [bundles, filteredPages, filteredActions]);

  // Keep highlight in range as the list shrinks/grows.
  useEffect(() => {
    if (highlight >= flat.length) setHighlight(0);
  }, [flat.length, highlight]);

  // Reset state on open/close. Closing also clears query so the
  // next open starts fresh.
  useEffect(() => {
    if (!open) {
      setQuery("");
      setBundles([]);
      setHighlight(0);
    }
  }, [open]);

  const close = useCallback(() => setOpen(false), []);

  const activate = useCallback(
    (
      item:
        | { kind: "bundle"; hit: BundleHit }
        | { kind: "page"; page: PageEntry }
        | { kind: "action"; action: ActionEntry },
    ) => {
      if (item.kind === "bundle") navigate(`/bundles/${item.hit.id}`);
      else if (item.kind === "page") navigate(item.page.path);
      else if (item.action.path) navigate(item.action.path);
      else if (item.action.run) item.action.run();
      setOpen(false);
    },
    [navigate],
  );

  // Global keyboard handler. Combines the open hotkey (⌘K / Ctrl-K)
  // with the in-modal nav handlers (↑/↓/Enter). Attaching to window
  // rather than a wrapper element keeps the JSX free of "static
  // element with onKeyDown" a11y warnings.
  useEffect(() => {
    function onKey(e: KeyboardEvent): void {
      const cmd = isMac() ? e.metaKey : e.ctrlKey;
      // Open / close hotkey.
      if (cmd && e.key.toLowerCase() === "k") {
        if (isInsideTextField(e.target) && !open) return;
        e.preventDefault();
        setOpen((prev) => !prev);
        return;
      }
      // While the palette is open, drive the list with the
      // keyboard. Esc closes (Polaris's Modal also closes on Esc
      // by default; we still call close() here so the state is
      // deterministic in tests).
      if (!open) return;
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setHighlight((h) => (flat.length === 0 ? 0 : (h + 1) % flat.length));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setHighlight((h) =>
          flat.length === 0 ? 0 : (h - 1 + flat.length) % flat.length,
        );
      } else if (e.key === "Enter") {
        if (flat.length === 0) return;
        e.preventDefault();
        const item = flat[highlight];
        if (item) activate(item);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, flat, highlight, activate]);

  return (
    <Modal open={open} onClose={close} title="Search BundleForge">
      <Modal.Section>
        <BlockStack gap="300">
          <TextField
            label="Search"
            labelHidden
            value={query}
            onChange={setQuery}
            autoComplete="off"
            placeholder="Search bundles, jump to a page, or run an action…"
            autoFocus
          />

          {flat.length === 0 && (
            <Text as="p" tone="subdued">
              No matches.
            </Text>
          )}

          {bundles.length > 0 && (
            <BlockStack gap="100">
              <Text as="p" variant="bodySm" tone="subdued">
                Bundles
              </Text>
              {bundles.map((hit, i) => (
                <ResultRow
                  key={`bundle-${hit.id}`}
                  active={highlight === i}
                  onClick={() => activate({ kind: "bundle", hit })}
                  primary={hit.title}
                  secondary={hit.type}
                />
              ))}
            </BlockStack>
          )}

          {filteredPages.length > 0 && (
            <BlockStack gap="100">
              <Text as="p" variant="bodySm" tone="subdued">
                Pages
              </Text>
              {filteredPages.map((page, i) => {
                const flatIndex = bundles.length + i;
                return (
                  <ResultRow
                    key={`page-${page.id}`}
                    active={highlight === flatIndex}
                    onClick={() => activate({ kind: "page", page })}
                    primary={page.label}
                    secondary={page.path}
                  />
                );
              })}
            </BlockStack>
          )}

          {filteredActions.length > 0 && (
            <BlockStack gap="100">
              <Text as="p" variant="bodySm" tone="subdued">
                Actions
              </Text>
              {filteredActions.map((action, i) => {
                const flatIndex =
                  bundles.length + filteredPages.length + i;
                return (
                  <ResultRow
                    key={`action-${action.id}`}
                    active={highlight === flatIndex}
                    onClick={() => activate({ kind: "action", action })}
                    primary={action.label}
                    secondary={action.path ?? "Run"}
                  />
                );
              })}
            </BlockStack>
          )}
        </BlockStack>
      </Modal.Section>
    </Modal>
  );
}

interface ResultRowProps {
  active: boolean;
  onClick: () => void;
  primary: string;
  secondary?: string;
}

function ResultRow(props: ResultRowProps): JSX.Element {
  const { active, onClick, primary, secondary } = props;
  return (
    <Box
      padding="200"
      borderRadius="200"
      background={active ? "bg-surface-selected" : "bg-surface-secondary"}
    >
      <button
        type="button"
        onClick={onClick}
        style={{
          width: "100%",
          textAlign: "left",
          background: "transparent",
          border: "none",
          padding: 0,
          cursor: "pointer",
        }}
      >
        <InlineStack align="space-between" blockAlign="center">
          <Text as="span" fontWeight="semibold">
            {primary}
          </Text>
          {secondary && (
            <Text as="span" tone="subdued" variant="bodySm">
              {secondary}
            </Text>
          )}
        </InlineStack>
      </button>
    </Box>
  );
}
