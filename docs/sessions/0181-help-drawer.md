# Session 0181 — In-app help drawer

- **Date:** 2026-05-06
- **Milestone(s):** M-181
- **Branch:** claude/objective-sinoussi-77ae86
- **Commit(s):** TBD

---

## Goal

Surface the existing 9-article `docs/help/` markdown library
inside the admin so a merchant doesn't have to leave the app
to read "how do I publish a draft" or "what does atomic
inventory mean."

## What was done

- **Spec written:**
  `docs/specs/M-181-help-drawer.md`.

- **Server**:
  - New `src/routes/help.ts`:
    - `GET /api/v1/help/articles` returns
      `{ data: [{ id, title, category }] }`.
    - `GET /api/v1/help/articles/:id` returns
      `{ id, title, category, body }` with the raw markdown.
    - Articles read from `docs/help/*.md` and cached in
      memory after first request.
    - `id` is restricted to `^[a-z0-9-]+$`; anything else →
      404 without touching the filesystem (path-traversal
      hardening).
    - Categories come from a small static map
      (getting-started → "Getting started", pricing →
      "Bundles", etc.). Keeps the markdown files free of
      frontmatter.
    - Articles are sorted by category then title for stable
      list order.
  - Mounted at `/api/v1/help` in `src/server/index.ts`.

- **Frontend**:
  - New `frontend/src/components/HelpDrawer.tsx`:
    - Polaris `Modal size="large"`, two-column Grid
      layout: article list (with search) on the left,
      rendered markdown on the right.
    - Lazy-loads the article list on first open;
      per-article fetches are cached in component state.
    - Hotkey: `?` (Shift+/) opens the drawer when not
      inside an input / textarea / contenteditable.
    - Cross-component pub/sub: a window
      `bundleforge:open-help` CustomEvent also opens the
      drawer (used by the ⌘K palette's "Open help"
      action).
    - Tiny inline markdown renderer (`MarkdownView`)
      handles headings, paragraphs, lists, fenced code
      blocks, and inline `**bold**` / `` `code` `` /
      `[text](url)`. URLs are filtered through `isSafeUrl`
      so `javascript:` / `data:` URIs render as plain text
      instead of an `<a>` element.
  - Mounted globally in `App.tsx` `Shell` alongside
    `<CommandPalette />`.
  - Added an "Open help" entry to the CommandPalette's
    Actions section. The action dispatches
    `bundleforge:open-help` so any merchant who lives on
    ⌘K never needs to learn the `?` hotkey.

## Tests added

- New `src/routes/help.test.ts` (5 cases):
  - GET /articles returns the list with non-empty titles.
  - GET /articles/:id returns the markdown body.
  - GET /articles/does-not-exist → 404.
  - Path-traversal attempts (`etc%2Fpasswd`, `...`, etc.)
    are rejected with 404 before any filesystem access.
  - Category map drives the response (e.g.
    `getting-started` → "Getting started").

- New `frontend/src/components/HelpDrawer.test.tsx` (6 cases):
  - Lazy-fetches the article list on first open.
  - Clicking an article fetches and renders its body.
  - The `bundleforge:open-help` CustomEvent opens the
    drawer when fired from anywhere.
  - MarkdownView renders `[text](https://…)` as `<a>`.
  - MarkdownView strips `javascript:` URLs to plain text
    (no `<a>` rendered).
  - MarkdownView renders `**bold**` and `` `code` ``.

## Acceptance criteria status

- [x] Compiles, lints clean (no new violations), 691/691
  vitest pass.
- [x] `?` opens the drawer from any route.
- [x] CommandPalette → "Open help" opens the drawer.
- [x] Article list + selected article body render from the
  server.
- [x] Path-traversal attempt returns 404.

## Verified by hand

- `npx vitest run src/routes/help.test.ts` → 5/5.
- `npx vitest run frontend/src/components/HelpDrawer.test.tsx`
  → 6/6.
- `npx vitest run` (full) → 691 passed, 13 skipped.
- `npm run typecheck` → clean.
- `npm run lint` → 6 pre-existing errors / 17 pre-existing
  warnings; no new violations.

## Deferred

- **Frontmatter-driven categories** in the markdown files.
  Static map is sufficient for 9 files; revisit if the
  library grows past ~20.
- **Body full-text search**. Initial filter is
  title-substring; body search needs a small client-side
  index. Cheap to add later.
- **In-app changelog** ("What's new") sourced from session
  logs. Logs are merchant-unfriendly without curation;
  deferring until a merchant asks.
- **Deep links** (`?help=getting-started` query param).
  Same handoff pattern as M-180's templates if needed.

## Notes

The article list cache lives on the Express router instance
because mounting `installHelpRoutes()` is a one-shot at
server boot. A full restart picks up edited markdown; that's
fine for the dev cycle. Adding hot-reload would mean a
file-watcher and is overkill for content that ships in the
deployed image.

The markdown renderer is intentionally small (~120 LOC) — no
markdown library was already in the deps and pulling one in
just for the help drawer would be heavy. Block-level parsing
splits on blank lines + walks line-by-line; inline parsing
handles `**bold**`, `` `code` ``, and `[text](url)` via a
hand-rolled tokenizer with a `javascript:` URL guard.

The cross-component "open help" pattern uses a window
CustomEvent rather than React context. That keeps
HelpDrawer.tsx and CommandPalette.tsx fully decoupled —
neither imports the other — and means M-182 / M-183 can
trigger the drawer the same way without threading props
through a context provider.

Phase R4 progress: 2 of 4 done. M-182 (unified toast /
confirm / skeleton patterns) is next: distill the
ad-hoc `<Toast>` wrappers and confirm modals scattered
across pages into a shared hook + helper functions so
every surface emits the same UX.
