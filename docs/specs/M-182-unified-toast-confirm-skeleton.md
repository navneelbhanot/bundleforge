# M-182 — Unified toast / confirm / skeleton patterns

> Third milestone of Phase R4 (`docs/plans/rich-admin-ui-roadmap.md`).
> A targeted refactor that replaces the ad-hoc Toast wrappers
> and confirm modals scattered across pages with shared
> primitives so every surface emits the same UX.

---

## Why

Phase R3 added enough surfaces (saved views, bulk actions,
templates, ⌘K, help drawer) that the same UI primitives are
now duplicated across 6+ files:

- **Toast**: `BundlesListPage`, `BundleDetailPage`, and
  several others each maintain their own
  `useState<string | null>` + `<Toast>` JSX. A page that
  navigates away mid-toast loses it; a child component that
  wants to surface a success message has to thread props
  upward.
- **Confirm dialog**: At least three flavors today —
  AdvancedTab's typed-confirm Delete (M-175),
  BundlesListTable's bulk archive/delete confirms (M-177)
  and saved-view delete confirm (M-176). All three are
  hand-rolled `<Modal>` blocks with subtly different copy
  and button order.
- **Skeleton / loading state**: `PageLoading` exists for
  full-page loaders. Inline "Loading articles…" /
  "Loading performance…" `<Text>` placeholders are scattered
  across components.

This milestone introduces a small set of primitives, mounts
them globally, and migrates the highest-traffic consumers.
Other consumers stay on the existing pattern until they're
touched for unrelated reasons; M-182 isn't a "rewrite
everything" pass.

---

## Scope

### `useToasts()` + `<ToastHost />`

New `frontend/src/components/shell/Toasts.tsx`:
- React context exposing `{ show, dismiss }` to any
  component in the tree.
- `show(message, opts?)` queues a toast (later toasts
  replace earlier ones — Polaris only renders one at a time
  inside a Frame).
- `dismiss()` clears the current toast.
- `<ToastHost />` mounts a Polaris `<Toast>` whenever the
  current message is non-null. Reads from context so any
  consumer can call `useToasts().show(...)` and the host
  renders the toast in its `<Frame>` portal.

### `<ConfirmDialog />`

New `frontend/src/components/shell/ConfirmDialog.tsx`:
- Props:
  - `open: boolean`
  - `title: string`
  - `body: ReactNode | string`
  - `confirmLabel: string` (default `"Confirm"`)
  - `cancelLabel: string` (default `"Cancel"`)
  - `destructive?: boolean` — flips the primary button to
    Polaris `destructive`.
  - `requireTyped?: string` — when set, the primary action
    is disabled until the user types this exact string in
    a confirmation text field. Matches the typed-Delete
    pattern from AdvancedTab.
  - `loading?: boolean`
  - `onConfirm: () => void | Promise<void>`
  - `onCancel: () => void`
- Internally a Polaris `<Modal>` with primary + secondary
  actions wired through.

### `<Skeleton />` / `<SkeletonRows />`

New `frontend/src/components/shell/Skeleton.tsx`:
- Thin wrappers over Polaris's existing `SkeletonBodyText`,
  `SkeletonDisplayText`, `SkeletonThumbnail`. Adds an
  `<InlineLoader text="Loading articles…">` helper that
  consolidates the "subtle text + spinner" pattern used
  in HelpDrawer, PerformanceTab, etc.

### Mount + provider

`App.tsx`:
- Wrap `<Shell />` in a new `<ToastsProvider>` so every
  component below it can call `useToasts()`.
- Render `<ToastHost />` once inside the existing `<Frame>`
  in `BundlesListPage` (and elsewhere where `<Frame>` is
  already mounted) — Polaris requires `<Toast>` to live
  inside a `<Frame>`.

### Consumer migrations (this session)

Three high-traffic surfaces:
1. `BundlesListPage` — drop the local `toast` state and
   `setToast(...)` calls; use `useToasts().show(...)`.
2. `BundleDetailPage` — same migration.
3. `AdvancedTab` typed-Delete — replace the inline Modal
   with `<ConfirmDialog requireTyped="DELETE" destructive />`.
4. `BundlesListTable` bulk archive/delete confirms — replace
   the inline Modal with `<ConfirmDialog destructive />`.
5. `BundlesListTable` saved-view delete — replace the
   inline Modal with `<ConfirmDialog destructive />`.

Other Toast/Modal users (Integrations tab, API tokens tab,
HelpDrawer's empty-state text) keep their existing patterns
for now.

### Tests

- `frontend/src/components/shell/Toasts.test.tsx` (new, 3 cases):
  - `useToasts().show()` outside a provider throws a clear
    error.
  - Calling `show()` mounts a Polaris `<Toast>` with the
    message.
  - Calling `show()` twice replaces the message (second
    wins).

- `frontend/src/components/shell/ConfirmDialog.test.tsx`
  (new, 4 cases):
  - Renders the title + body when `open=true`.
  - Confirm button calls `onConfirm`.
  - With `requireTyped="DELETE"`, the primary button stays
    disabled until the user types `DELETE`.
  - With `destructive=true`, primary uses Polaris's
    destructive tone (button has `destructive` data attr or
    matching aria).

- Migrated consumer tests (`BundleDetailPage`,
  `BundlesListPage`, `BundlesListTable.AdvancedTab`,
  etc.) keep passing without rewrites.

---

## Acceptance criteria

- [x] Compiles, lints clean (no new violations), all vitest
  pass.
- [x] `useToasts().show()` works from any component in the
  tree.
- [x] AdvancedTab + BundlesListTable confirm dialogs use the
  shared `<ConfirmDialog />`.
- [x] No new behavioral regressions — all pre-M-182 tests
  still pass without modification (or with mechanical
  updates only).

---

## Out of scope (deferred)

- **Migrating every Toast / Modal user**. Integrations tab,
  API tokens tab, BillingPanel, etc. stay on their existing
  patterns until they're touched. The new primitives don't
  replace anything by force.
- **Toast stacking** (queue multiple toasts and show them
  in order). Replace-latest is good enough today; Polaris's
  Toast itself doesn't natively stack inside a single Frame.
- **Snackbar-style undo** ("Bundle archived [Undo]"). The
  shared API supports a custom action object on the toast
  later; nothing renders it yet.
- **Toast persistence across navigation**. The Toasts
  context is rooted at App so it already survives route
  changes; a long-lived toast just stays visible.
