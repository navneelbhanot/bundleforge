# Session 0197 — M-187 · Support page

- **Date:** 2026-05-07
- **Milestone(s):** M-187
- **Branch:** claude/objective-sinoussi-77ae86

---

## Goal

Ship a discoverable `/support` route that consolidates the
help-articles library + a contact surface, plus add a "Help"
entry to the NavMenu and top-bar tabs. Before this milestone
the only path to merchant help was the ⌘K palette → "Open
help" or the `?` hotkey — both invisible to a merchant who
hadn't read the docs.

## What was done

- **Spec:** `docs/specs/M-187-support-page.md`.

### Frontend

- **Refactor** — extracted the inline `MarkdownView` component
  + its helpers (`tokenizeInline`, `renderInline`,
  `parseBlocks`, `isSafeUrl`) from
  `frontend/src/components/HelpDrawer.tsx` into a new shared
  `frontend/src/components/help/MarkdownView.tsx` (~250 LOC).
  Drawer + SupportPage both import from it. Drawer behaviour
  unchanged; the existing 6 HelpDrawer tests still pass.
- **New** `frontend/src/pages/SupportPage.tsx` (~290 LOC):
  - `<Page>` with title "Support" and a one-sentence subtitle.
  - Search input that live-filters articles by title
    (case-insensitive substring).
  - Two-pane Grid: left pane is a Card listing articles
    grouped by category, right pane is a Card rendering the
    selected article via `<MarkdownView>`.
  - Hash-routing — `/support#bundle-types` selects that
    article. Deep-links work; reload restores the same
    article; back/forward cycles correctly. Auto-selects the
    first article if no hash is present so the right pane is
    never blank.
  - Body cache: `bodyCache` Record keeps fetched articles
    around so re-clicking is instant.
  - "Talk to us" card with:
    - "Open live chat" Button — only rendered when
      `window.$crisp` exists. A small `useCrispReady()` hook
      polls every 250ms for up to 3 seconds since Crisp loads
      asynchronously after page mount.
    - "Email <support@bundleforge.app>" Button — `mailto:`
      anchor; address overridable via `VITE_SUPPORT_EMAIL`.
  - "Resources" card listing optional external links
    (Changelog / Status page / GitHub issues), each rendered
    only when its `VITE_*` env var is set. When all three are
    unset (dev / fresh install), a friendly placeholder text
    appears.
- **Modified** `frontend/src/App.tsx`:
  - new `<Route path="/support" element={<SupportPage />}>`;
  - top-bar `NAV_TABS` gains `{ id: "support", content: "Help",
    path: "/support" }` as the last entry.
- **Modified** `frontend/src/components/NavMenu.tsx` — App
  Bridge `<ui-nav-menu>` gains `<a href="/support">Help</a>`
  as the last entry.
- **Modified** `.env.example` — documents 4 new optional
  `VITE_*` keys: `VITE_SUPPORT_EMAIL`, `VITE_CHANGELOG_URL`,
  `VITE_STATUS_URL`, `VITE_GITHUB_REPO_URL`.

### Test infra

- **Modified** `src/config/env.test.ts` — the
  ".env.example contains no keys that are not in the schema"
  check now skips VITE_* prefixed keys. These are build-time
  substitutions consumed by Vite for the SPA bundle; the
  server's runtime envSchema doesn't (and shouldn't) know
  about them.

## Tests

- **New** `frontend/src/pages/SupportPage.test.tsx` — 5 cases:
  - Renders article list with category headings.
  - Filters article list by title (case-insensitive substring).
  - Auto-selects first article on load and renders its body.
  - Renders contact card with `mailto:` email link.
  - Resources card placeholder when no env links set.
- 808/808 pass (was 803). Typecheck clean. Lint baseline
  unchanged.

## Verified by hand

- N/A this session — visual verification on the dev store is
  the user's next step after deploy.

## Surprises and learnings

- **Polaris `Page subtitle` prop accepts a string but renders
  small subdued text below the title** — useful here for the
  "Average response under one business day" tagline without
  needing an extra Card.
- **`window.$crisp` may not exist for ~1s after the page
  mounts** because the Crisp script loads asynchronously. The
  Live-chat button mounts conditionally based on a polling
  hook with a 3-second timeout; if Crisp never loads (env var
  unset), the button just stays hidden.
- **`.env.example` test enforced parity with the server's Zod
  schema** — adding new VITE_* keys broke the test until I
  taught it to skip them. Worth keeping the test's strictness
  for runtime keys since it caught a real drift bug back in
  the M-001 era.
- **Polaris `Button` with `url` + `external`** renders a
  proper `<a target="_blank" rel="noopener noreferrer">` —
  used for both the email mailto and the resource links. No
  custom anchor wrapping needed.

## Deferred

- **In-app email submission form** — clicking "Email support"
  pops the user's mail client. Building an in-app form that
  POSTs to a backend → SES/SendGrid is its own milestone (needs
  email transport wired up; STATE.md lists SMTP as not-yet-built).
- **Article search by body content** (vs just title) — title
  filter is enough at 9 articles.
- **Localization of help articles** — articles stay
  English-only for v1.
- **Dynamic FAQ generation from Sentry/error events** — future
  idea.

## Handoff

Phase R5 milestones now: M-184, M-185, M-186, M-187 all done.
No queued roadmap milestone. Open backlog items in STATE.md
unchanged from M-186 close.
