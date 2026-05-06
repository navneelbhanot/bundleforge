# Session 0195 — M-185 · Settings two-pane left sidebar

- **Date:** 2026-05-07
- **Milestone(s):** M-185
- **Branch:** claude/objective-sinoussi-77ae86

---

## Goal

Replace SettingsPage's horizontal Polaris `<Tabs>` row with a
two-pane Polaris `<Layout>`: a vertical sidebar of section
buttons on the left, the active section's cards on the right.
Closes Phase R5 and the broader rich-admin-ui work begun in
M-161.

## What was done

- **Spec:** `docs/specs/M-185-settings-left-sidebar.md`.

### Frontend

- **New component**
  `frontend/src/components/settings/SettingsSidebar.tsx` (~50 LOC).
  Polaris `<Box>` + `<BlockStack>` + a `<Button>` per tab.
  Active tab uses `variant="primary"`, inactive use
  `variant="tertiary"`. `fullWidth` + `textAlign="start"` so
  the button row reads as a list. Pure: no internal state,
  takes `tabs`, `activeIndex`, `onSelect` props.

- **Modified** `frontend/src/pages/SettingsPage.tsx`:
  - Replaced the `<Tabs ... />` block with a `<Layout>` two-pane
    structure:
    ```
    <Layout>
      <Layout.Section variant="oneThird">
        <SettingsSidebar tabs={TABS} activeIndex={tabIndex} onSelect={selectTab} />
      </Layout.Section>
      <Layout.Section>{active section's cards}</Layout.Section>
    </Layout>
    ```
  - Stripped the 9 inner `<Layout><Layout.Section>...</Layout.Section></Layout>`
    wrappers around each tab's body (general / inventory /
    pricing / cart / notifications / display + the three
    single-component sections integrations / localization / api).
    Each one now renders either its existing `<BlockStack gap="400">`
    or, for the bare-component sections, just the component
    directly. The outer Layout is the only one; the inner
    BlockStacks become direct children of the right pane's
    `<Layout.Section>`.
  - Removed the `polarisTabs` useMemo (no longer needed) and
    the unused `useMemo` and `Tabs` imports.
  - Hash routing logic unchanged. `selectTab` is reused as the
    sidebar's onSelect handler.

### Tests

- **New** `frontend/src/components/settings/SettingsSidebar.test.tsx` —
  3 cases: renders one button per tab, click calls onSelect
  with the index, active button has a different className than
  inactive (proxy for primary-vs-tertiary variant).
- All 20 existing SettingsPage vitest tests continue to pass
  unchanged — every section's Save flow, hash deep-link, tag
  recipient behaviour, etc. The refactor touched the page shell
  only; section bodies were left intact.

## Tests + lint

- `npm run typecheck` — clean.
- `npx vitest run` — 792 passed, 13 skipped (one unrelated
  flaky `tests/property/webhook.throughput.test.ts` passed on
  retry, documented as pre-existing).
- `npm run lint` — 6 errors / 16 warnings (baseline, unchanged).

## Verified by hand

- N/A this session — visual verification on a Shopify dev
  store is the user's next step after deploy. The 20-case
  SettingsPage test suite pinned the section-body behaviour.

## Surprises and learnings

- **Polaris doesn't ship a vertical Tabs primitive.** The
  recommended pattern is exactly what we did: `Layout` +
  `Layout.Section variant="oneThird"` for the sidebar pane,
  then build the vertical button list yourself. Polaris's own
  Settings examples in their pattern library follow this
  shape.
- **The 9 inner Layout wrappers were a refactoring win.** Each
  section had been written when the page's outer container was
  a `<Page>` with no Layout (M-161). With the new outer Layout
  in place, the inner Layouts were dead weight that would have
  caused weird double-padding. Stripping them simplified the
  tree without behavior change.
- **`replace_all: true` made the wrapper strip safe and fast.**
  The opening (`<Layout>\n            <Layout.Section>\n              <BlockStack gap="400">`)
  and closing (`              </BlockStack>\n            </Layout.Section>\n          </Layout>`)
  patterns were uniform across 7 of the 9 sections, so two
  replace_all edits handled the bulk of the change. The other
  two sections (integrations / localization / api — single-component
  bodies without an inner BlockStack) were edited explicitly.

## Deferred

- **Per-merchant settings favourites / custom ordering.**
  Future R6.
- **Settings search ("type to filter sections").** Not needed
  at 10 sections.
- **A11y audit of the sidebar nav.** Polaris Buttons are
  keyboard-navigable out of the box; a follow-on session can
  do an explicit a11y pass.
- **Mobile pill-row affordance.** Polaris Layout's `oneThird`
  variant collapses to a stacked column at sm and below, which
  is acceptable for v1. We can add a horizontal scrollable
  pill row at xs/sm in a follow-up if user testing wants it.

## Handoff

Phase R5 closes. No queued roadmap milestone. The
rich-admin-ui work that began at M-161 is complete:
13 settings tabs, 8-tab bundle detail, IndexFilters /
saved views / bulk / templates on the bundle list,
cmd+K palette, help drawer, dashboard, settings sidebar.
