# M-187 — Support page (`/support`)

- **Phase:** R5+
- **Status:** spec
- **Depends on:** M-181 (help drawer + 9 markdown articles + the
  `/api/v1/help/articles` route)
- **Followed by:** none queued

---

## Why

The help drawer (M-181) is genuinely useful — 9 markdown articles
covering bundle types, pricing, inventory, storefront, FAQ — but
it's only reachable via the ⌘K palette ("Open help") or the `?`
hotkey when not inside an input. Merchants who don't know about
either never find it. The NavMenu has no Help / Support entry.
The Crisp live-chat widget is wired (see [.env.example](.env.example#L47))
but is gated on `CRISP_WEBSITE_ID`, which is unset in production
today, so there's no visible chat surface either. There's no
"contact us" link anywhere; the privacy policy and ToS still
have `{{support_email}}` placeholders.

Net result: a merchant who hits a snag has no obvious recourse.

## What ships

A dedicated `/support` page that consolidates merchant-help into
one discoverable surface, plus a NavMenu entry that lands them
there.

### SupportPage layout (top to bottom)

1. **Hero** — `<Page title="Support">` with a search box that
   live-filters the article list by title (substring,
   case-insensitive). Subtitle: "Browse 9 articles, message us,
   or open a chat — we usually respond within one business day."
2. **Article reader (two-pane)** — left: filtered article list
   (collapses to a Select on `xs`/`sm`). Right: the selected
   article's rendered markdown using the same `MarkdownView`
   component the drawer uses today. URL state: the article id
   is the route hash (e.g. `/support#bundle-types`); deep-links
   work; back/forward cycles correctly.
3. **Contact card** — Polaris Card with:
   - "Live chat" Button (only visible when Crisp is configured,
     detected via `window.$crisp`; otherwise hidden). Click →
     `window.$crisp.push(["do", "chat:open"])`.
   - "Email support" Button → `mailto:` link to a configurable
     address (default `support@bundleforge.app`).
   - Text: "Average response under one business day. If your
     issue is on a live order, mention the order number."
4. **Resources card** — small list of links:
   - "Changelog" (placeholder anchor — `/changelog` doesn't exist
     yet; the link goes to `https://bundleforge.app/changelog` as
     external) — *if and only if* the merchant has a Shopify
     domain available; otherwise just shown as plain text.
   - "Status page" — same pattern, external link to a public
     status page if `STATUS_URL` env is set; hidden otherwise.
   - "GitHub issues" — external link to the public repo's
     issues page if `GITHUB_REPO_URL` env is set; hidden
     otherwise.

Resources card uses a simple "render-only-what's-configured"
pattern so the page doesn't show empty/dead links in dev.

### Sharing the markdown renderer

The `MarkdownView` component currently lives inline at the
bottom of `HelpDrawer.tsx` (not exported). Extract to
`frontend/src/components/help/MarkdownView.tsx` so both the
drawer and the new SupportPage import it. Move the helpers
(`splitBlocks`, `renderBlock`, `renderInline`, etc.) too.
HelpDrawer keeps working unchanged — it just imports from the
new location.

### NavMenu entry

Add `<a href="/support">Help</a>` after Billing (last entry).
Same pattern as the other plain-anchor entries — App Bridge
intercepts the click and syncs the outer URL.

### Optional: dashboard "Need help?" button

Skip in this milestone. The NavMenu entry plus ⌘K palette plus
`?` hotkey are three discoverability paths already; a fourth is
overkill. Defer.

## File-level changes

### Frontend

- **New** `frontend/src/components/help/MarkdownView.tsx` —
  the inline `MarkdownView` extracted from
  `HelpDrawer.tsx`. Plus `splitBlocks`, `renderBlock`,
  `renderInline`. Same code, just relocated; export the
  component.
- **New** `frontend/src/pages/SupportPage.tsx` (~250 LOC).
  Fetches `/api/v1/help/articles` on mount, displays the
  two-pane layout, hash-routes the selected article id,
  renders contact + resources cards.
- **Modified** `frontend/src/components/HelpDrawer.tsx` —
  remove the inline `MarkdownView` definition; import from
  the new shared file. No behavior change.
- **Modified** `frontend/src/App.tsx` —
  - new `<Route path="/support" element={<SupportPage />}>`;
  - top-bar `NAV_TABS` gains a `support` entry at the end.
- **Modified** `frontend/src/components/NavMenu.tsx` —
  `<a href="/support">Help</a>` after Billing.

### Server

No changes. The existing `/api/v1/help/articles` and
`/api/v1/help/articles/:id` routes (M-181) already serve
everything SupportPage needs.

### Env

Optional new env vars (read by the frontend via Vite's
`import.meta.env` and the same meta-tag substitution pattern
used for Crisp):

- `VITE_SUPPORT_EMAIL` — default `support@bundleforge.app`.
- `VITE_STATUS_URL` — optional; resources card shows the link
  when set.
- `VITE_GITHUB_REPO_URL` — optional; same pattern.
- `VITE_CHANGELOG_URL` — optional; same pattern. Default `null`
  (link hidden).

`.env.example` gets a "Support page" block documenting these.

## Acceptance criteria

- [ ] `npm run typecheck`, `npx vitest run`, `npm run lint` all
      pass at session close.
- [ ] `/support` renders the two-pane layout with the article
      list on the left and the selected article's markdown on
      the right.
- [ ] Search box filters the article list by title substring
      (case-insensitive).
- [ ] Clicking an article updates the URL hash; reload restores
      the same article.
- [ ] NavMenu shows "Help" as the last entry (after Billing);
      clicking navigates to `/support`.
- [ ] Top-bar tabs include "Help" at the end; clicking it
      activates the same selection logic as the other tabs.
- [ ] Contact card "Email support" Button is a valid `mailto:`
      anchor pointing to `support@bundleforge.app` (or the env
      override).
- [ ] Contact card "Live chat" Button is shown only when
      `window.$crisp` exists; clicking it opens the chat.
- [ ] Resources card hides any link whose env var is unset
      (so dev with no env shows zero rows or just whatever
      defaults — no broken anchors).
- [ ] HelpDrawer continues to work unchanged from ⌘K and `?`
      hotkey.
- [ ] Tests:
  - SupportPage: renders article list, search filters articles,
    clicking an article updates hash, contact card present
    (~3 cases).
  - MarkdownView: regression tests — same coverage as the
    drawer's existing markdown tests if any; otherwise add 1-2
    happy-path cases (heading + bold + inline code rendering).

## Out of scope (deferred)

- **In-app email submission form** — clicking "Email support"
  pops the user's mail client. Building an in-app form that
  POSTs to a backend → SES/SendGrid is its own milestone (needs
  email transport wired up; STATE.md "Future code work" lists
  SMTP as not-yet-built).
- **Chat history persistence** — Crisp owns chat sessions; we
  don't persist anything.
- **Dynamic FAQ generation from Sentry/error events** —
  interesting future idea, not in scope.
- **Localization of help articles.** Articles stay English-only
  for v1.
- **Article search by body content** (vs just title) —
  client-side title filter is enough at 9 articles.

## Risks

- **Crisp script load timing.** `window.$crisp` may not exist
  for the first ~1s after page load. Mitigation: render the
  Live chat button conditionally based on `useState` that
  flips when a `setInterval` detects `window.$crisp` exists,
  capped at 3s before giving up.
- **Hash-routing conflicts.** SettingsPage already uses hash
  routing for tabs (e.g. `/settings#display`). SupportPage uses
  hash routing for article id (e.g. `/support#bundle-types`).
  No conflict — hashes are scoped per-route.
- **Extracting MarkdownView from HelpDrawer** is a small
  cross-file refactor; verify the drawer's existing tests
  still pass.

## Followed by

No queued milestone. This closes the "merchant has no
discoverable help" gap.
