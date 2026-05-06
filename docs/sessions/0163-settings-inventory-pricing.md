# Session 0163 — Settings · Inventory + Pricing tabs

- **Date:** 2026-05-06
- **Milestone(s):** M-163 (covered Inventory and Pricing in one
  session per the spec — each alone was too small to fit the
  one-milestone-per-session sizing rule)
- **Branch:** claude/objective-sinoussi-77ae86
- **Commit(s):** TBD

---

## Goal

Build out the Inventory and Pricing tabs in the SettingsPage shell.
Re-surface the M-161-hidden `safetyLock` toggle on the Inventory
tab without moving its data location.

## What was done

- **Spec written:** `docs/specs/M-163-settings-inventory-pricing.md`.

- **Server** — extended `src/routes/settings.ts`:
  - New `InventoryPatch` and `PricingPatch` Zod (strict).
  - InventoryPatch covers lowStockThreshold (0..100000),
    oversellPolicy (enum), auditRetentionDays (7..3650),
    snapshotFrequency (enum), lowStockAlertEnabled (bool).
  - PricingPatch covers roundingRule (enum), currencyFormatterOverride
    (max 120 chars), b2bMarkupPercent (-100..1000),
    defaultDiscountType (7-value enum mirroring the
    PricingRulesEditor types).
  - GET response now includes `inventory` and `pricing` raw
    subobjects (no fallbacks server-side; the frontend layers
    `INVENTORY_DEFAULTS` and `PRICING_DEFAULTS` over the response).
  - PUT reuses the `mergeSubobject` helper from M-162 — extending
    deep-merge to two more keys was a one-line change each.

- **Frontend** — extended `frontend/src/pages/SettingsPage.tsx`:
  - New `InventoryBlock` / `PricingBlock` types + DEFAULTS.
  - **StockGuardsCard**: safetyLock checkbox (saves immediately
    on toggle), lowStockThreshold TextField number with range
    validation, oversellPolicy Select with explainer copy in the
    options, lowStockAlertEnabled checkbox with helpText flagging
    that the email channel lands in M-165.
  - **AuditCard**: auditRetentionDays TextField with the
    explanatory note that ADR-0003 enforces immutability via a
    Postgres trigger so retention only governs pruning.
    snapshotFrequency Select.
  - **RoundingCard**: roundingRule Select (nearest cent / .99 /
    .95), currencyFormatterOverride TextField with placeholder
    syntax helpText.
  - **PricingDefaultsCard**: defaultDiscountType Select using the
    same 7 enum values as the PricingRulesEditor.
    b2bMarkupPercent TextField (negatives allowed, range
    -100..1000).
  - Added `patchInventory`, `patchPricing`, and a separate
    `patchSafetyLock` (top-level) so the existing webhook handler
    that reads `settings.safetyLock` keeps working unchanged.
  - Inventory and Pricing TabSpecs flipped to `"ready"`.

## Tests added

- `src/routes/settings.test.ts` (19 cases, +6):
  - Full inventory patch round-trip.
  - Inventory.oversellPolicy enum rejection.
  - auditRetentionDays = 5 → 400 (below 7-day floor).
  - Pricing patch with negative B2B markup round-trips.
  - Pricing.roundingRule enum rejection.
  - Inventory deep-merge: lowStockThreshold save doesn't drop
    a previously saved oversellPolicy.

- `frontend/src/pages/SettingsPage.test.tsx` (12 cases, +4):
  - Inventory tab renders Stock guards + Audit headings.
  - Pricing tab renders Rounding + Defaults headings.
  - Inventory PATCH body is shaped `{ inventory: { ... } }` (not
    leaked under display/general).
  - safetyLock toggle on the Inventory tab patches at the **top
    level**, not under inventory — locks in the contract with the
    webhook handler.
  - Updated the placeholder test to point at M-164 (Cart &
    checkout) since Inventory + Pricing now resolve.

## Acceptance criteria status

- [x] Compiles, lints, all 498 vitest tests pass.
- [x] /settings#inventory and /settings#pricing render real cards.
- [x] PUT round-trips every new field.
- [x] safetyLock continues to land at `settings.safetyLock`
  top-level (test "safetyLock toggle on Inventory tab patches
  top-level (not under inventory)").
- [x] Inventory + Pricing TabSpecs flipped to `"ready"`.

## Verified by hand

- `npx vitest run src/routes/settings.test.ts` → 19/19.
- `npx vitest run frontend/src/pages/SettingsPage.test.tsx` → 12/12.
- `npx vitest run` (full) → 498 passed, 13 skipped.
- `npm run typecheck` → clean (after widening `patchSubobject`'s
  key parameter union to include `"inventory"` and `"pricing"`).

## Deferred (per spec §Out of scope)

- Low-stock alert email channel + recipients — M-165 (Notifications).
- B2B markup applied at checkout — separate post-R1 task; needs the
  pricing engine to read `settings.pricing.b2bMarkupPercent` for
  customers tagged b2b at cart-transform time.
- Audit-log pruning daemon honoring `auditRetentionDays` — separate
  cron worker task.
- Snapshot frequency wiring — separate cron task.
- Currency formatter consumed by storefront blocks — separate task.

## Notes

The decision to keep `safetyLock` at the top level (rather than
relocating it to `settings.inventory.safetyLock`) is deliberate:
the live webhook handler at
`src/webhooks/handlers/ordersCreate.ts:177` reads
`shop.settings.safetyLock` directly, and migrating live data
without a backwards-compat read would be a footgun. The Inventory
tab UI just renders the existing top-level value with a separate
save path. If we ever want to move it, that's its own milestone
with a data migration.

Combining two tabs in one milestone is still within the
"≈200–800 LOC, fits in one session" rule from CLAUDE.md §4 — the
diff was ~600 lines including tests. If the user wants future
milestones split tighter, M-164 will go solo since Cart &
Checkout has more nuance (mode toggle interacts with the Cart
Transform Function path).
