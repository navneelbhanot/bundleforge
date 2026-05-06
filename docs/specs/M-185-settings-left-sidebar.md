# M-185 — Settings · two-pane left sidebar layout

- **Phase:** R5 (post-roadmap polish — net-new milestone)
- **Status:** spec
- **Depends on:** M-161 (settings shell + General tab) — provides
  the 10-tab structure this milestone restyles
- **Followed by:** none (R5 closes)

---

## Why

Today `SettingsPage` (M-161) renders 10 settings categories as a
horizontal Polaris `<Tabs>` row across the top of the page. With 10
tabs, the row wraps on narrow viewports and forces eye-saccades
across the screen to find the wanted section. Settings-heavy
Shopify apps idiomatically use a vertical left-sidebar pattern
inside the iframe (Polaris `Layout.Section variant="oneThird"` on
the left, content on the right) — easier to scan, doesn't wrap,
mobile-collapsible.

Note: this is **inside** our iframe. Shopify's own outer left
sidebar (the one rendered by App Bridge `<ui-nav-menu>`) keeps
"Settings" as a single top-level entry. We do not nest settings
sub-categories into the outer App Bridge nav (anti-pattern for
Shopify apps).

## What ships

A refactor of `SettingsPage.tsx` that:

1. Replaces the horizontal `<Tabs>` row with a Polaris `<Layout>`
   two-pane:
   - `Layout.Section variant="oneThird"` — vertical section list
     (10 entries: General, Display, Inventory, Pricing, Cart &
     checkout, Notifications, Integrations, API & webhooks,
     Localization, Billing).
   - `Layout.Section` (main) — the active section's cards.
2. Keeps **everything else identical**. Hash routing
   (`#general`, `#display`, etc.) continues to work and is the
   sole source of truth for the active section. All 10 tab
   contents render exactly the same. URL deep-links continue to
   work. No server change.
3. Mobile breakpoint: Polaris `Layout` already collapses
   `variant="oneThird"` to a single column under `sm`. We add a
   small `<Box>` of section pills above the active content as a
   mobile-friendly alternative — collapse the vertical list to a
   horizontal scrollable row only on `xs` / `sm`.

### The vertical section list

A new component `frontend/src/components/settings/SettingsSidebar.tsx`:

- Polaris `<Box>` with `padding="200"` and `borderColor="border"`.
- 10 `<button>`s wrapped as Polaris `<Button>` with
  `variant={isActive ? "primary" : "tertiary"}` and `fullWidth`.
- Each button updates `window.location.hash = "#" + section`,
  which the existing hash-listener in `SettingsPage` already reads.
- Each button has its Polaris icon (re-using whatever icons the
  current `<Tabs>` uses — currently none, so we add a small set:
  `SettingsIcon`, `ColorIcon`, `InventoryIcon`, etc. from
  `@shopify/polaris-icons` if obvious mappings exist; otherwise
  no-icon stays acceptable).

### Mobile-collapse strategy

- On `<Layout>`'s built-in `sm` breakpoint, the section list
  drops below the content (Polaris default for
  `variant="oneThird"`). That alone is acceptable — we don't have
  to render a horizontal pill row to ship this milestone. Test
  on the dev store and decide.

## File-level changes

- **New:** `frontend/src/components/settings/SettingsSidebar.tsx`
  (~50 LOC).
- **Modified:** `frontend/src/pages/SettingsPage.tsx` —
  - Replace `<Tabs tabs={tabs} selected={selectedTabIndex}>` with
    `<Layout><Layout.Section variant="oneThird"><SettingsSidebar
    active={section} /></Layout.Section><Layout.Section>{active
    section's cards}</Layout.Section></Layout>`.
  - Drop the `tabs` array literal (replaced by a static `SECTIONS`
    array imported by the sidebar).
  - Hash-routing `useEffect` unchanged.
  - All 10 section bodies (`renderGeneral()`, `renderDisplay()`, ...)
    unchanged.
- **No server changes.**

## Acceptance criteria

- [ ] `npm run typecheck`, `npx vitest run`, `npm run lint` all
      pass at session close.
- [ ] `/settings` renders the new two-pane layout: vertical sidebar
      on the left with 10 buttons, content area on the right.
- [ ] Clicking a sidebar button updates `window.location.hash`
      and the right pane swaps to that section's cards.
- [ ] Direct deep-link to `/settings#display` selects Display in
      the sidebar AND shows Display's cards on first paint.
- [ ] Browser back/forward cycles through hash changes correctly.
- [ ] Active sidebar button is visually distinct (Polaris primary
      variant) from inactive ones.
- [ ] On mobile / narrow viewports, the layout collapses
      gracefully (sidebar above content per Polaris default —
      acceptable for v1).
- [ ] All existing SettingsPage vitest tests still pass (every
      tab's Save flow, hash deep-link, tag-recipient behavior,
      etc.). No test rewrites — the section bodies are untouched.
- [ ] New `SettingsSidebar.test.tsx` — 3 cases:
  - Renders 10 buttons.
  - Active button has primary variant.
  - Click writes the expected hash.

## Out of scope (deferred)

- Per-merchant settings favorites / custom ordering. Future.
- Settings search ("type to filter sections"). Future — not
  needed at 10 sections.
- Restyle of the cards within each section. Each card stays
  exactly as-is.
- A11y audit of the new sidebar nav. Polaris Buttons inside a
  Box give keyboard support out of the box; a follow-on session
  can do an explicit a11y pass.

## Risks

- **Test surface for SettingsPage is large** (M-167 added the
  Localization tab tests, M-168 added API/webhooks tests, M-165
  added Notifications tests). The refactor touches the page
  shell only — section bodies are untouched function calls — so
  the test suite should stay green without rewrites. If a test
  asserts on the `<Tabs>` DOM directly, it'll need a tweak.
- **Polaris `<Layout>` doesn't ship a built-in vertical Tabs
  pattern.** We're composing it ourselves out of `Box` + `Button`.
  Polaris's official pattern for this surface is exactly that —
  `<Layout.Section variant="oneThird">` with whatever you want.

## Followed by

R5 closes after this lands. No follow-on milestone queued.
