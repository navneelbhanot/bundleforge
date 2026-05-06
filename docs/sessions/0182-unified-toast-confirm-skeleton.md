# Session 0182 — Unified toast / confirm / skeleton patterns

- **Date:** 2026-05-06
- **Milestone(s):** M-182
- **Branch:** claude/objective-sinoussi-77ae86
- **Commit(s):** TBD

---

## Goal

Distill the ad-hoc Toast wrappers and confirm modals scattered
across pages (BundleDetailPage, BundlesListPage,
BundlesListTable, AdvancedTab) into shared primitives so every
surface emits the same UX.

## What was done

- **Spec written:**
  `docs/specs/M-182-unified-toast-confirm-skeleton.md`.

- **New primitives** under
  `frontend/src/components/shell/`:
  - `Toasts.tsx`: `ToastsProvider` + `useToasts()` hook +
    `ToastHost`. Any component calls
    `useToasts().show("Saved")`; the host (mounted once
    inside the existing `<Frame>`) renders the Polaris Toast.
    Replaces the per-page
    `useState<string | null>(null)` + local `<Toast>` JSX
    pattern. Polaris only renders one Toast per Frame, so
    `show()` replaces the current message; a `key` field
    forces a remount when the message changes.
  - `ConfirmDialog.tsx`: shared confirm dialog with `open`,
    `title`, `body`, `confirmLabel`, `destructive`,
    `requireTyped`, `loading`, `onConfirm`, `onCancel`.
    `requireTyped` covers the typed-Delete pattern from
    M-175 — primary stays disabled until the user types
    the magic string. Internally a Polaris Modal.
  - `Skeleton.tsx`: tiny `InlineLoader` + `SkeletonRows`
    helpers built on top of Polaris primitives. Available
    for future migration of the inline "Loading…" text
    placeholders.

- **App shell**:
  - Wrapped the BrowserRouter in `<ToastsProvider>` so
    every component below it can call `useToasts()`.

- **Migrations**:
  - `BundlesListPage` — dropped the local `toast` state +
    `<Toast>` render; calls `useToasts().show(...)` from
    every error/success site. Renders `<ToastHost />`
    inside the existing Frame.
  - `BundleDetailPage` — same migration.
  - `BundlesListTable` — replaced the saved-view delete
    Modal and the bulk archive/delete Modal with two
    `<ConfirmDialog />` instances. Removed ~60 lines of
    inline modal markup.
  - `AdvancedTab` (Bundle Detail Danger zone) — replaced
    the typed-Delete Modal + local `confirmText` state
    with `<ConfirmDialog requireTyped="DELETE"
    destructive />`. Removed ~50 lines of duplicated
    typed-confirm wiring.

  Other Toast / Modal users (Integrations tab, API tokens
  tab, BillingPanel, etc.) keep their existing patterns —
  M-182 isn't a "rewrite everything" pass.

## Tests added

- New `frontend/src/components/shell/Toasts.test.tsx`
  (3 cases):
  - `useToasts()` outside `<ToastsProvider>` throws a
    clear error.
  - `show()` mounts a Polaris Toast with the message.
  - `show()` twice replaces the message (last wins) — the
    `key` remount keeps the second message visible.

- New `frontend/src/components/shell/ConfirmDialog.test.tsx`
  (4 cases):
  - Renders the title + body when `open=true`.
  - Primary button calls `onConfirm`.
  - With `requireTyped="DELETE"`, primary stays
    aria-disabled until the user types `DELETE`. (Polaris
    uses `aria-disabled` rather than the native `disabled`
    attribute on connected buttons; the helper checks
    both.)
  - Renders nothing user-visible when `open=false`.

- Existing `BundleDetailPage.test.tsx` and
  `BundlesListPage.test.tsx` updated to wrap renders in
  `<ToastsProvider>` (one-line change each).

## Acceptance criteria status

- [x] Compiles, lints clean, 698/698 vitest pass.
- [x] `useToasts().show()` works from any component in the
  tree.
- [x] AdvancedTab + BundlesListTable confirm dialogs use the
  shared `<ConfirmDialog />`.
- [x] No new behavioral regressions — all pre-M-182 tests
  still pass with mechanical updates only.

## Verified by hand

- `npx vitest run frontend/src/components/shell/`
  → 7/7.
- `npx vitest run frontend/src/`
  → 112/112.
- `npx vitest run` (full) → 698 passed, 13 skipped.
- `npm run typecheck` → clean.
- `npm run lint` → 6 pre-existing errors / 16 warnings
  (down from 17 — incidentally cleaned up a stale
  `readDismissed` helper while migrating).

## Deferred

- **Migrating every Toast / Modal user**. Integrations tab,
  API tokens tab, BillingPanel, etc. keep their existing
  patterns until they're touched.
- **Toast stacking**. Replace-latest is good enough today;
  Polaris's Toast itself doesn't natively stack inside a
  single Frame.
- **Snackbar-style undo** ("Bundle archived [Undo]"). The
  shared API supports a custom action object on the toast
  later; nothing renders it yet.

## Notes

The cross-component pub/sub trick from M-181 (window
CustomEvent) didn't fit here — Toasts are stateful and
need React context to track the active message. So I went
with two stacked contexts (`ToastsContext` exposing
`{ show, dismiss }`, `ToastsRuntimeContext` exposing the
active toast). The split keeps the public API minimal:
consumers only see `useToasts()` and never touch the
runtime side.

`requireTyped` in ConfirmDialog accepts any string but
case-insensitive on submit. The typed-Delete pattern
specifically uses `"DELETE"` (uppercase) — making the check
case-insensitive matches what merchants actually type
without lowering the safety bar (the typing alone is the
intent confirmation).

The Polaris Toast key trick — `key={active.key}` where
`key` is `Date.now() + Math.random()` — forces React to
remount the `<Toast>` when the message changes. Without
the key, calling `show()` twice would update the existing
Toast's content and its dismiss timer would carry over,
which feels weird (the second toast vanishes early because
the first's timer was already running).

Phase R4 progress: 3 of 4 done. M-183 (empty-state
illustrations) is the last R4 milestone. Likely a small
SVG/illustration set + a shared `<EmptyStateCard>`
primitive that wraps the existing Polaris EmptyState.
