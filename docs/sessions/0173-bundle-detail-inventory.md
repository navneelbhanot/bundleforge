# Session 0173 — Bundle Detail · Inventory tab

- **Date:** 2026-05-06
- **Milestone(s):** M-173
- **Branch:** claude/objective-sinoussi-77ae86
- **Commit(s):** TBD

---

## Goal

Populate the Inventory tab placeholder added by M-169 with real
per-bundle override controls so a merchant can:

- Override the shop-wide low-stock threshold, oversell policy,
  and low-stock alert toggle from M-163 — for one specific
  bundle only.
- Set a "pause when any component drops below N" guard.
- Toggle "component-only mode" so the storefront renders the
  bundle as individual components rather than a single bundle
  line.

## What was done

- **Spec written:**
  `docs/specs/M-173-bundle-detail-inventory.md`.

- **Prisma schema** (`prisma/schema.prisma`):
  - Added `inventoryRules` JSONB column to `Bundle`
    (default `{}`).
    Migration:
    `prisma/migrations/20260506220000_bundle_inventory_rules/`
    — NOT applied per CLAUDE.md §5.

- **Types** (`src/types/index.ts`):
  - New `OversellPolicy` union and `InventoryRulesInput`
    interface covering `lowStockThreshold`, `oversellPolicy`,
    `lowStockAlertEnabled`, `pauseWhenComponentBelow`,
    `componentOnlyMode`.
  - Added `inventoryRules?: InventoryRulesInput` to
    `CreateBundleInput`.

- **Service** (`src/services/bundles/index.ts`):
  - New `validateInventoryRules(input)` helper:
    - `lowStockThreshold` / `pauseWhenComponentBelow` must be
      integers 0..100000 (mirrors M-163's shop-level bounds).
    - `oversellPolicy` must be `prevent | allow_negative |
      allow_to_zero`.
    - `lowStockAlertEnabled` and `componentOnlyMode` must be
      booleans.
  - `create()` validates + persists.
  - `update()` deep-merges with the same null-removes-key
    semantics as M-171 Display and M-172 Customers: `null` for
    any key triggers `delete merged[k]` so the bundle falls
    back to the shop default at render time.

- **Frontend** (`frontend/src/components/bundleDetail/InventoryTab.tsx`,
  new file):
  - Three cards:
    1. **Low-stock thresholds** — number `TextField` for
       `lowStockThreshold` (helpText surfaces shop default
       when blank), number `TextField` for
       `pauseWhenComponentBelow` (0 disables), `Checkbox` for
       `lowStockAlertEnabled`.
    2. **Oversell policy** — Polaris `Select` with "Use shop
       default" sentinel option that sends `null`.
    3. **Bundle rendering mode** — `Checkbox` for
       `componentOnlyMode` plus an info Banner explaining the
       implication for the storefront.
  - Each card has its own per-card Save firing
    `onSave({ inventoryRules: { ... } })`. Empty number fields
    and "Use shop default" send `null` so the server deletes
    the override.
  - Top-level Banner explains M-173b is the storefront
    consumer-side wire-up.

- **BundleDetailPage** wiring:
  - `BundleDetail` interface gains `inventoryRules?: InventoryRules`.
  - New tab branch wires `<InventoryTab />` with
    `bundle.inventoryRules`, `shopInventoryDefaults`, and the
    page's existing `save()`.
  - Lazy-fetches `/api/v1/settings` once when the merchant
    lands on the Inventory tab — same pattern Display tab
    uses for shop defaults.
  - Updated the placeholder fallback condition to exclude
    `customers` and `inventory`.

## Tests added

- `src/services/bundles/index.test.ts` (38 cases, +5):
  - Persists inventoryRules on create with all 5 fields.
  - Rejects oversellPolicy outside the enum.
  - Rejects pauseWhenComponentBelow > 100000.
  - Update deep-merges (saving lowStockThreshold keeps
    componentOnlyMode + oversellPolicy).
  - Update with `null` removes a single override.

- `frontend/src/components/bundleDetail/InventoryTab.test.tsx`
  (new, 4 cases):
  - Renders the three card headings.
  - Editing lowStockThreshold + Save sends the int.
  - Switching oversellPolicy + Save sends the new enum.
  - Toggling componentOnlyMode + Save sends `true`.

- `frontend/src/pages/BundleDetailPage.test.tsx` (8 cases, +1):
  - `#inventory` deep-link asserts the new "Low-stock
    thresholds" heading renders.
  - Updated the "switching tabs preserves dirty title" test to
    use `#performance` (still placeholder for M-174) since
    `#inventory` now renders real content.
  - Updated the placeholder regression test to point at M-174.

## Acceptance criteria status

- [x] Compiles, lints clean (no new violations), 614/614 vitest pass.
- [x] /bundles/:id#inventory renders three real cards.
- [x] Inventory rules round-trip end-to-end.
- [x] Deep-merge preserves siblings; `null` removes a single
  override key.

## Verified by hand

- `npx vitest run src/services/bundles/index.test.ts` → 38/38.
- `npx vitest run frontend/src/components/bundleDetail/InventoryTab.test.tsx`
  → 4/4.
- `npx vitest run frontend/src/pages/BundleDetailPage.test.tsx`
  → 8/8.
- `npx vitest run` (full) → 614 passed, 13 skipped.
- `npm run typecheck` → clean.
- `npm run lint` → 6 pre-existing errors only; no new
  violations from M-173.

## Deferred

- **M-173b** — Storefront enforcement. Cart Transform Function
  reads a new `bundleforge.inventory_rules` product metafield
  (parallel to `bundleforge.eligibility` from M-172b), evaluates
  current component stock against `pauseWhenComponentBelow`, and
  either pauses the bundle or expands components-only when
  `componentOnlyMode` is true. Theme block honors the same
  flag for Add-to-cart rendering.
- A worker that auto-archives a bundle when it stays below
  `pauseWhenComponentBelow` for >24h. Pause-vs-archive policy is
  its own product decision.
- Per-component thresholds (today the guard is a single int
  applied to the minimum across all components).

## Notes

This is the fourth Phase R2 tab using the
"validate + deep-merge + null-removes-key" pattern. By M-173
this is the established convention — Performance + Activity
(M-174) and Advanced (M-175) are the only Phase R2 tabs left,
and neither needs the override-shop-default mechanic the way
Display / Inventory do.

The Inventory tab differs slightly from Display / Customers:
two of its five fields (`pauseWhenComponentBelow`,
`componentOnlyMode`) are bundle-only with no shop-level
counterpart. They live in the same `inventoryRules` blob for
consistency rather than splitting into a second column —
storage is cheap, but a merchant scanning the schema later
should see one "per-bundle inventory configuration" object.

The "low-stock alert" Checkbox doesn't have a tri-state
(true/false/inherit) UI today. Toggling the Checkbox on or off
sends `true`/`false` explicitly. To reset to "inherit shop
default" the merchant has to clear the field via API or a
follow-up Reset button — flagging as a polish item if it comes
up in beta feedback.
