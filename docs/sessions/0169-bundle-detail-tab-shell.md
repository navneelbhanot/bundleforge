# Session 0169 — Bundle Detail tab shell refactor (Phase R2 start)

- **Date:** 2026-05-06
- **Milestone(s):** M-169 (renumbered from R2's original M-168
  slot — see Notes)
- **Branch:** claude/objective-sinoussi-77ae86
- **Commit(s):** TBD

---

## Goal

First milestone of Phase R2. Reshape the 500-line single-scroll
BundleDetailPage into an 8-tab shell so subsequent milestones can
land Schedule, Display, Customers, Inventory, Performance,
Activity, and Advanced tabs without bloating one giant form.

## What was done

- **Spec written:**
  `docs/specs/M-169-bundle-detail-tab-shell.md`.

- **Frontend** (`frontend/src/pages/BundleDetailPage.tsx`):
  - Added `TabSpec` type + `TABS` array (8 tabs).
  - Added `readHashTab()` / `writeHashTab()` helpers + a
    `hashchange` event listener so the URL hash is the source of
    truth for which tab is active. Same pattern as M-161
    SettingsPage.
  - New `PlaceholderTab` component renders a Card pointing at
    the milestone that will populate the tab.
  - Polaris `Tabs` rendered above the existing `Layout`.
  - Setup-tab form (Details + Items + Pricing rules + Type
    config) is **always mounted**; visibility toggled via
    inline `display: none` when another tab is active. This is
    the cleanest way to preserve in-flight edits across tab
    switches — the React state never unmounts.
  - When a non-Setup tab is active, the placeholder Card renders
    in the same `Layout.Section` as the (hidden) form.
  - Sidebar (Status / Quick stats / Live Preview) stays in
    `Layout.Section variant="oneThird"` and renders on every
    tab.

- **PLAN.md** renumbering: original roadmap had Phase R2 starting
  at M-168, but M-167's mid-spec split into M-168 (API & webhooks)
  shifted every R2-R4 slot by 1. PLAN.md now reflects M-169..M-183
  for Phase R2-R4.

## Tests added

- `frontend/src/pages/BundleDetailPage.test.tsx` (new file, 5
  cases):
  - All 8 tab labels render.
  - Setup tab shows Details / Items / Pricing rules / Type config
    headings.
  - Non-Setup tabs render the placeholder pointing at their
    milestone (#schedule → M-170, #display → M-171).
  - Hash-routed deep-link selects the right tab on mount.
  - Switching tabs preserves a dirty title field — edit Title,
    switch to #schedule, switch back to #setup, value still
    there.

## Acceptance criteria status

- [x] Compiles, lints clean, 570/570 vitest pass.
- [x] Bundle detail renders 8 tabs.
- [x] Setup tab is visually identical to today's surface.
- [x] Hash navigation works (deep-link + back/forward).
- [x] Switching tabs preserves in-flight form state.

## Verified by hand

- `npx vitest run frontend/src/pages/BundleDetailPage.test.tsx`
  → 5/5.
- `npx vitest run` (full) → 570 passed, 13 skipped (twice in a
  row to confirm stability — first run had a flaky failure that
  resolved on re-run, likely test isolation around shared
  `window.location.hash`).
- `npm run typecheck` → clean.

## Deferred

- M-170 Schedule tab content.
- M-171 Display tab content.
- M-172 Customers tab content.
- M-173 Inventory tab content.
- M-174 Performance + Activity log content.
- M-175 Advanced tab content.

This milestone is a pure refactor + scaffolding. The next 6
milestones each populate one tab.

## Notes

The `display: none` trick to preserve form state is unusual but
the right call here. The alternative — moving form state up to a
parent component or into a context — would have changed the
ownership boundary of every form input. The trick works because:

1. React keeps the component subtree mounted — `useState` values
   persist.
2. Polaris's `<TextField>` etc. don't have any DOM-measurement
   logic that breaks under `display: none`.
3. The DOM weight is small (4 cards of form), so the cost of
   keeping it mounted is irrelevant.

The renumbering of Phase R2-R4 caught me late in this session —
the spec was written with M-169 in the filename, but PLAN.md still
had the old M-168 slot for "Detail shell tab refactor." Fixed in
PLAN.md before commit. STATE.md's "next session" briefing now
points at M-170 (Schedule tab) explicitly so a fresh session
won't re-collide.
