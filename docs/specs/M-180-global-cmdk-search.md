# M-180 — Global cmd+k search palette

> First milestone of Phase R4 — cross-cutting polish
> (`docs/plans/rich-admin-ui-roadmap.md`). A modal command
> palette triggered by ⌘K / Ctrl-K that lets the merchant
> jump anywhere in the admin from the keyboard.

---

## Why

Phase R3 made the bundle list rich enough that finding things
inside it works, but the cross-page workflow is still
mouse-driven: a merchant has to click a sidebar tab to leave
the current page, click another to come back. Common moves
("create bundle", "browse templates", "go to settings →
billing") all live behind two-or-three click chains.

A ⌘K palette is the standard solution — Linear, Notion, Slack,
GitHub all ship one. It's also the right venue for actions that
don't fit on a primary toolbar (like "Browse templates" from
M-179, which we currently squeeze into the page header
secondaryActions).

This sets the global keyboard pattern for Phase R4: M-181's
help drawer and M-182's confirm/skeleton patterns will all
honor ⌘K behavior.

---

## Scope

### Frontend

New `frontend/src/components/CommandPalette.tsx`:
- Polaris `Modal` size="small" with no header chrome.
- Single `TextField` autoFocus search input at top.
- Result list grouped into three sections:
  1. **Bundles** — debounced (250ms) call to
     `/api/v1/bundles?search=<query>&limit=10`. Empty when
     query is empty. Shows up to 10 by-title matches.
  2. **Pages** — static list of nav targets:
     Bundles, Orders, Inventory, Inventory audit, Analytics,
     AI suggestions, A/B tests, Settings, Billing. Filtered
     by query substring.
  3. **Actions** — static list:
     - Create bundle → `/bundles/new`
     - Browse templates → fires a callback (the page that
       owns the templates modal handles it; the palette
       just knows the action's name + handler).
     Filtered by query substring.
- Empty query: show only Pages + Actions (no API hit).
- Keyboard:
  - `↑` / `↓` navigate the result list (highlight wraps).
  - `Enter` activates the highlighted result (navigate or
    fire callback, then close).
  - `Esc` closes.

Mount globally in `App.tsx` `Shell` so the palette is
reachable from every route.

### Hotkey

Global `keydown` listener on `window`:
- `e.key === "k"` AND (`e.metaKey` on macOS || `e.ctrlKey`
  elsewhere) → open palette.
- Already-open: re-pressing toggles closed.
- Suppress when the active element is a textarea / input /
  contenteditable so the merchant can still hit ⌘K *inside*
  a textarea without us hijacking it. (Edge case but worth
  having from day one.)

### Browse-templates wiring

Today the BundlesListPage owns the templates modal. The
palette needs to be able to open it from any route, not just
`/`. Path of least resistance: navigate to `/?openTemplates=1`,
read the query param in `BundlesListPage` and auto-open the
modal once on mount, then strip the param.

### Tests

New `frontend/src/components/CommandPalette.test.tsx`
(4 cases):
- Renders the page list when query is empty (no API hit).
- Typing a query filters the page list by substring.
- Typing "vip" hits `/api/v1/bundles?search=vip&limit=10`
  (verified via fetch stub).
- Pressing Enter on a highlighted page navigates to its path
  (verified via stubbed `useNavigate`).

---

## Acceptance criteria

- [x] Compiles, lints clean (no new violations), all vitest
  pass.
- [x] ⌘K (or Ctrl-K) opens the palette from any route.
- [x] Empty query shows Pages + Actions only.
- [x] Bundle search hits the existing `/api/v1/bundles?search=`
  endpoint.
- [x] Enter on a highlighted result navigates / triggers,
  then closes the palette.
- [x] Esc closes.

---

## Out of scope (deferred)

- **Recent items** ("recently viewed bundles") in the
  zero-query state. Needs a small client-side history;
  M-180 keeps the zero-query view static.
- **Fuzzy match** in the page/action filter. Simple
  case-insensitive substring is fine for ~10 entries; we
  upgrade if the registry grows past ~50.
- **Quick-action shortcuts** (e.g. `B` for bundles, `O` for
  orders without ⌘K). Belongs in a vimium-style milestone
  later.
- **Search across orders / customers / inventory**. Bundles
  is the only entity with a server-side `search` filter
  today; others need a search index first.
- **Persisting the last query**. Closes empty by design.
