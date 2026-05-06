# M-169 — Bundle Detail tab shell refactor

> First milestone of Phase R2 (`docs/plans/rich-admin-ui-roadmap.md`).
> Refactors the existing BundleDetailPage into a tabbed shell so
> subsequent milestones can land Schedule, Display, Customers,
> Inventory, Performance, Activity, and Advanced tabs without
> growing one giant scrolling form.

---

## Why

`frontend/src/pages/BundleDetailPage.tsx` is currently a single
~500-line scrolling layout: Details + Items + Pricing rules +
Type config in the main column, Status + Quick stats + Live
Preview in the sidebar. That layout will break visually as we
add more sections in M-170..M-175 — each new feature would push
the live preview further down the page or require horizontal
scrolling.

This milestone reshapes the same content into 8 tabs, with the
live preview sidebar staying put. **Visual parity for the Setup
tab** — every existing card stays the same — but the merchant can
now click into focused sub-screens.

---

## Scope

### Frontend

In `frontend/src/pages/BundleDetailPage.tsx`:

1. Define a `TabSpec` array (mirroring the M-161 SettingsPage
   pattern):
   ```ts
   const TABS: TabSpec[] = [
     { id: "setup",      hash: "setup",      content: "Setup",       status: "ready" },
     { id: "schedule",   hash: "schedule",   content: "Schedule",    status: "deferred", milestone: "M-170" },
     { id: "display",    hash: "display",    content: "Display",     status: "deferred", milestone: "M-171" },
     { id: "customers",  hash: "customers",  content: "Customers",   status: "deferred", milestone: "M-172" },
     { id: "inventory",  hash: "inventory",  content: "Inventory",   status: "deferred", milestone: "M-173" },
     { id: "performance",hash: "performance",content: "Performance", status: "deferred", milestone: "M-174" },
     { id: "activity",   hash: "activity",   content: "Activity",    status: "deferred", milestone: "M-174" },
     { id: "advanced",   hash: "advanced",   content: "Advanced",    status: "deferred", milestone: "M-175" },
   ];
   ```

2. Read/write tab via `window.location.hash` like M-161. The hash
   appends to the existing path: `/bundles/<id>#schedule` etc.

3. Render Polaris `Tabs` above the existing 2-column `Layout`.

4. **Setup tab** — the current main-column content (Details +
   Items + Pricing rules + TypeConfigPanel). No visual change.

5. **Other tabs** — render a `PlaceholderTab` Card with the same
   "Coming in M-NNN" copy as M-161.

6. **Sidebar (Status + Quick stats + Live Preview)** — stays put
   on every tab. The merchant always sees status + preview while
   editing.

7. **Dirty state preservation** — switching tabs **must not**
   discard in-flight changes to title/description/items/rules.
   The state already lives in the page-level component
   (`useState`), so as long as the form components stay mounted
   between tab switches, edits survive. The cleanest way: render
   the Setup tab's form unconditionally and just toggle its
   visibility via CSS when another tab is active. That way the
   form's React state never unmounts.

   Tradeoff: the form DOM stays in the page even when a
   placeholder tab is showing. For 4 cards of form, this is
   fine — the page already renders them all today.

### Tests

- `frontend/src/pages/BundleDetailPage.test.tsx` (new file —
  there's no test for this page yet, surprisingly):
  - Page renders the 8 tab labels.
  - Setup tab shows the Details / Items / Pricing rules / Type
    config sections.
  - Other tabs show the placeholder Card with the milestone
    pointer.
  - Hash routing: `/bundles/<id>#schedule` selects the Schedule
    tab on mount.
  - Tab switch preserves dirty title field.

---

## Acceptance criteria

- [x] Compiles, lints clean, all vitest pass.
- [x] Bundle detail renders 8 tabs.
- [x] Setup tab is visually identical to today's surface.
- [x] Hash navigation works (deep-link, back/forward).
- [x] Switching tabs preserves in-flight form state.

---

## Out of scope (deferred per the roadmap)

- M-170 Schedule tab content.
- M-171 Display tab content.
- M-172 Customers tab content.
- M-173 Inventory tab content.
- M-174 Performance + Activity log content.
- M-175 Advanced tab content.

This milestone is a pure refactor + scaffolding. The next 6
milestones each populate one tab.
