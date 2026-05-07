# M-173 — Bundle Detail · Inventory tab

> Fifth milestone of Phase R2 (`docs/plans/rich-admin-ui-roadmap.md`).
> Per-bundle inventory rules so a merchant can override the
> shop-level Inventory defaults from M-163, set a "pause when any
> component < N" guard, and toggle component-only rendering.

---

## Why

Today every bundle inherits the shop-wide Inventory settings from
M-163 (low-stock threshold, oversell policy, low-stock alert
toggle). That works for most bundles but breaks down for
high-stakes ones:

- **Holiday gift box** — keeper SKU. Merchant wants to pause the
  bundle automatically the moment any component drops below 5,
  rather than letting it sell through and turn into a
  back-order nightmare.
- **Premium curated set** — merchant wants `prevent` oversell
  policy on this bundle even though the rest of the catalog is
  set to `allow_to_zero`.
- **Marketing-only bundle** — render the components in a grid on
  the storefront with their own Add-to-cart, but never sell the
  bundle SKU as one line. (Component-only mode.)

Same shape as the prior R2 tabs: persist now, storefront
enforcement (Cart Transform Function reads the rule blob, theme
block honors `componentOnlyMode`) lands in M-173b.

---

## Scope

### Server — Prisma schema

Add a single JSON column `inventoryRules` to the `Bundle` model:

```prisma
inventoryRules Json @default("{}") @map("inventory_rules")
```

Migration: `prisma/migrations/<ts>_bundle_inventory_rules/migration.sql`.
Reviewed before applying per CLAUDE.md §5.

Stored shape:
```jsonc
{
  "lowStockThreshold":        5,                     // int 0..100000, override of shop default
  "oversellPolicy":           "prevent",             // override of shop default
  "lowStockAlertEnabled":     true,                  // override of shop default
  "pauseWhenComponentBelow":  3,                     // int 0..100000, 0 disables
  "componentOnlyMode":        false                  // when true, never sell as a single bundle SKU
}
```

All fields optional. Missing field = "fall back to shop default
at render time" — merge logic in `update()` deletes the key when
sent as `null`, same null-removes-restriction pattern as M-171
Display and M-172 Customers.

### Server — types + service

- Extend `CreateBundleInput` in `src/types/index.ts` with
  `inventoryRules?: InventoryRulesInput`.
- New `InventoryRulesInput` interface mirroring the stored shape.
- `src/services/bundles/index.ts`:
  - New `validateInventoryRules(input)` helper:
    - `lowStockThreshold` — integer 0..100000 (matches M-163's
      shop-level constraint).
    - `oversellPolicy` — `"prevent" | "allow_negative" | "allow_to_zero"`.
    - `lowStockAlertEnabled` — boolean.
    - `pauseWhenComponentBelow` — integer 0..100000. `0` means
      "no pause guard" so the merchant can keep the override
      key set without firing. (`null` = "remove the override
      and fall back to shop default of no guard.")
    - `componentOnlyMode` — boolean.
  - `create()` validates + persists.
  - `update()` deep-merges with the same null-removes-key
    semantics as M-171/M-172.

### Frontend

- New `frontend/src/components/bundleDetail/InventoryTab.tsx`.
- Three cards:
  1. **Low-stock thresholds** — TextField (number) for
     `lowStockThreshold` with helpText that surfaces the shop
     default when unset; TextField (number) for
     `pauseWhenComponentBelow` (0 = disabled); Checkbox for
     `lowStockAlertEnabled`. Per-card Save fires
     `onSave({ inventoryRules: { ... } })`. Empty number fields
     send `null` to remove the override.
  2. **Oversell policy** — Polaris `Select` with options
     `Use shop default | Prevent oversell | Allow to zero |
     Allow negative`. "Use shop default" sends
     `oversellPolicy: null`.
  3. **Bundle rendering mode** — Checkbox for
     `componentOnlyMode` + Banner explaining the implication
     (theme block renders components individually with their
     own Add-to-cart instead of one bundle line).
- Top-level Banner explains M-173b is the storefront wire-up
  (Cart Transform Function honoring `pauseWhenComponentBelow`,
  theme block honoring `componentOnlyMode`).
- Bundle Detail page passes `bundle.inventoryRules` and
  `shopInventoryDefaults` (fetched lazily on tab entry, same
  pattern as Display tab fetching shop defaults).

### Tests

- `src/services/bundles/index.test.ts` (+5):
  - Persists inventoryRules on create with all 5 fields.
  - Rejects oversellPolicy not in the enum.
  - Rejects pauseWhenComponentBelow > 100000.
  - Update deep-merges (saving lowStockThreshold keeps
    componentOnlyMode).
  - Update with `null` removes the override.
- `frontend/src/components/bundleDetail/InventoryTab.test.tsx`
  (new, 4 cases):
  - Renders the three card headings.
  - Editing lowStockThreshold + Save sends the int.
  - Switching oversellPolicy + Save sends the new enum.
  - Toggling componentOnlyMode + Save sends `true`.
- `frontend/src/pages/BundleDetailPage.test.tsx` (+1):
  - `#inventory` deep-link asserts the new "Low-stock
    thresholds" heading renders.
  - Update the placeholder regression test to point at M-174
    (Performance) — Inventory is now wired.
  - Update the "switching tabs preserves dirty title" test to
    use `#performance` (still placeholder for M-174).

---

## Acceptance criteria

- [x] Compiles, lints clean, all vitest pass.
- [x] /bundles/:id#inventory renders three real cards.
- [x] Inventory rules round-trip end-to-end (POST + PUT).
- [x] Deep-merge preserves siblings on partial saves; `null`
  removes a single key.

---

## Out of scope (deferred)

- **M-173b** — Storefront enforcement: Cart Transform Function
  reads `mintbundle.inventory_rules` product metafield (parallel
  to `mintbundle.eligibility`), evaluates against current stock,
  and either pauses the bundle or expands components-only.
- Worker that auto-archives a bundle when it stays below
  `pauseWhenComponentBelow` for >24h — pause-vs-archive policy
  is its own decision.
- Per-component thresholds (today the guard is a single int that
  applies to the minimum across all components).
