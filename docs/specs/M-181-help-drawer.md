# M-181 — In-app help drawer

> Second milestone of Phase R4 (`docs/plans/rich-admin-ui-roadmap.md`).
> Surfaces the existing 9-article `docs/help/` library inside
> the admin so a merchant doesn't have to leave the app to
> find "how do I publish a draft" or "what does atomic
> inventory mean."

---

## Why

`docs/help/` has shipped since the audit-driven UI polish (Session
0158) but is currently only available as files in the repo. A
new merchant fresh from install has no way to reach it
without opening the GitHub README. M-181 wires the same
markdown library directly into the admin via a Polaris Modal
"Help drawer" triggered by:

- A "Help" entry in the M-180 ⌘K command palette (no extra
  hotkey required for keyboard-driven users).
- The `?` keystroke (Shift+/ on US keyboards) when not
  already in a text field.
- A small "Help" button somewhere in the App shell (a
  conservative footer link will do).

This lays the groundwork for M-182 (unified toast / confirm /
skeleton patterns) and M-183 (empty-state illustrations) —
both will reference help articles.

---

## Scope

### Server

New `src/routes/help.ts`:
```
GET /api/v1/help/articles
GET /api/v1/help/articles/:id
```

- `GET /articles` returns
  `{ data: Array<{ id, title, category }> }`.
- `GET /articles/:id` returns
  `{ id, title, category, body }` with the raw markdown
  content. 404 when the id doesn't match a file.
- Articles read from `docs/help/<id>.md` at server startup,
  cached in memory. The `id` is the filename without the
  `.md` suffix; titles come from the first `# heading` in
  each file.
- **Path traversal guard**: `id` is restricted to
  `^[a-z0-9-]+$`. Anything else → 404 without touching
  the filesystem.
- **Categories** are inferred from a small static map (not
  per-file frontmatter — keeps the markdown files readable
  outside the app):
  - `getting-started` → "Getting started"
  - `bundle-types` → "Bundles"
  - `pricing` → "Bundles"
  - `inventory` → "Operations"
  - `storefront` → "Operations"
  - `troubleshooting` → "Troubleshooting"
  - `faq` → "Reference"
  - `why-mintbundle` → "Reference"
  - `README` → "Reference"

These two routes mount under the same `/api/v1` prefix as
the rest of the admin API — same auth + rate limiting as
bundles / settings.

### Frontend

New `frontend/src/components/HelpDrawer.tsx`:
- Polaris `Modal size="large"` (mirrors M-179
  TemplatesModal for visual consistency).
- Two-column layout via Polaris `Grid`:
  - **Left** (1/3): scrollable article list grouped by
    category. Search box at the top filters by title +
    body substring.
  - **Right** (2/3): selected article — title heading +
    rendered markdown.
- Lazy-fetches the article list once on first open;
  per-article fetch on click (cached in component state so
  re-clicks don't re-hit the server).

Tiny inline markdown renderer (a small `MarkdownView`
function in the same file):
- Block parsing: split on blank lines.
  - `^# `, `^## `, `^### ` → heading levels.
  - ` ```...``` ` fenced code → `<pre>`.
  - `^- ` / `^[0-9]+\. ` → unordered / ordered list.
  - Otherwise → paragraph.
- Inline parsing inside paragraphs / list items / headings:
  - `**bold**` → `<strong>`.
  - `` `code` `` → `<code>`.
  - `[text](url)` → `<a target="_blank">`. URLs that are
    not http(s) are rendered as plain text (security
    hardening: no `javascript:` URIs).

Hotkey: global `keydown` on `window`, ` (key === "?")`,
when the active element is not an input / textarea /
contenteditable. Sets the drawer open.

Mount: in `App.tsx` `Shell`, alongside `<CommandPalette />`.

Help action in CommandPalette:
- Add `{ id: "open-help", label: "Open help", run: ... }`
  to the action registry. The action calls a window-level
  custom event `mintbundle:open-help` that the HelpDrawer
  listens for. Cross-component pub/sub via `window` keeps
  the components decoupled.

### Tests

- `src/routes/help.test.ts` (new, 4 cases):
  - GET /articles returns the list with non-empty titles.
  - GET /articles/getting-started returns the markdown body.
  - GET /articles/does-not-exist → 404.
  - GET /articles/../../etc/passwd → 404 without filesystem
    touch (regex guard rejects the id).

- `frontend/src/components/HelpDrawer.test.tsx` (new, 4 cases):
  - Lazy-fetches the article list on first open.
  - Clicking an article fetches and renders its body.
  - The markdown renderer escapes `[evil](javascript:...)`
    to plain text.
  - The `?` hotkey opens the drawer (when not inside an
    input).

---

## Acceptance criteria

- [x] Compiles, lints clean (no new violations), all vitest
  pass.
- [x] `?` opens the drawer from any route.
- [x] CommandPalette → "Open help" opens the drawer.
- [x] Article list + selected article body render from the
  server.
- [x] Path traversal attempt returns 404.

---

## Out of scope (deferred)

- **Frontmatter-driven categories** in the markdown files.
  The static map is sufficient for 9 files; revisit if the
  library grows past ~20.
- **Search inside article body** (full-text). Initial filter
  is title-substring; body search needs a small client-side
  index. Cheap to add later.
- **Versioning / "What's new"**. Pulling from the session
  log for an in-app changelog was floated; deferring until
  a merchant asks. The session log is verbose and merchant-
  unfriendly without curation.
- **Deep links** (`?help=getting-started` query param). Not
  in M-181; same pattern as M-180 templates handoff if we
  need it.
- **External link to the GitHub source** of the help docs.
  Not added to the drawer chrome; the public docs URL is
  unstable today.
