# M-163 — Settings · Inventory + Pricing tabs

> Third milestone of Phase R1 (`docs/plans/rich-admin-ui-roadmap.md`).
> Covers two tabs in one milestone — Inventory and Pricing — both
> small enough that splitting would create empty sessions.

---

## Why

Inventory and pricing defaults are the merchant's most operational
levers. Today the only inventory toggle is `safetyLock` (a single
checkbox that was hidden by M-161's tab refactor); pricing has no
defaults surface at all.

This milestone surfaces:

- **Inventory tab** — `safetyLock` re-surfaced (it was already
  live and consumed by `src/webhooks/handlers/ordersCreate.ts`),
  plus low-stock threshold, oversell policy, audit retention,
  snapshot frequency, and a low-stock-alert toggle.
- **Pricing tab** — rounding rule, currency formatter override,
  B2B markup default, default discount type for new bundles.

Behaviour wiring varies: `safetyLock` is already wired (no-op
here, just UI). The new fields are **persisted and surfaced** but
behaviour wiring (e.g. low-stock alert emission, B2B markup
applied at checkout) lands in dedicated follow-on milestones —
this matches the M-161 / M-162 pattern of "options visible and
persistent now, behaviour reads land when the consumer is built."

---

## Scope

### Server

Extend `PatchSchema` in `src/routes/settings.ts` with two new
strict subobjects:

```ts
inventory: z.object({
  lowStockThreshold: z.coerce.number().int().min(0).max(100000).optional(),
  oversellPolicy: z.enum([
    "prevent", "allow_negative", "allow_to_zero"
  ]).optional(),
  auditRetentionDays: z.coerce.number().int().min(7).max(3650).optional(),
  snapshotFrequency: z.enum([
    "hourly", "every_6h", "daily", "weekly"
  ]).optional(),
  lowStockAlertEnabled: z.boolean().optional(),
}).strict()

pricing: z.object({
  roundingRule: z.enum(["nearest_cent", "ninety_nine", "ninety_five"]).optional(),
  currencyFormatterOverride: z.string().max(120).optional(),
  b2bMarkupPercent: z.coerce.number().min(-100).max(1000).optional(),
  defaultDiscountType: z.enum([
    "percentage", "flat_discount", "fixed", "tiered", "volume", "bogo", "custom"
  ]).optional(),
}).strict()
```

GET response gains `inventory` and `pricing` raw subobjects (no
fallbacks server-side; the frontend applies defaults). PUT uses
the existing `mergeSubobject` helper.

### Client

In `frontend/src/pages/SettingsPage.tsx`:

- Flip Inventory and Pricing TabSpec from `"deferred"` to `"ready"`.
- Inventory tab: two cards.
  - **Stock guards** — safetyLock (Checkbox), lowStockThreshold
    (TextField number), oversellPolicy (Select),
    lowStockAlertEnabled (Checkbox).
  - **Audit & snapshots** — auditRetentionDays (TextField with
    helpText "ADR-0003 enforces immutability — retention only
    affects pruning"), snapshotFrequency (Select).
- Pricing tab: two cards.
  - **Rounding & formatting** — roundingRule (Select),
    currencyFormatterOverride (TextField with helpText showing
    `{amount} {currency}` placeholder syntax).
  - **Defaults for new bundles** — defaultDiscountType (Select
    using the same 7 enum values exposed by the PricingRulesEditor),
    b2bMarkupPercent (TextField number, accepts negatives).

Both tabs use the existing `CardSaveBar` per-card pattern with
`patchSubobject("inventory", patch)` and
`patchSubobject("pricing", patch)`.

The previous Inventory placeholder is removed; the previous
top-of-General-tab safetyLock-banner concern from M-161 is moot
(it's now in a real card).

### Tests

- `src/routes/settings.test.ts` (extend):
  - PUT a valid inventory patch → round-trips.
  - PUT inventory.oversellPolicy: "weird" → 400.
  - PUT inventory.auditRetentionDays = 5 → 400 (below min 7).
  - PUT pricing.b2bMarkupPercent = 50 → round-trips.
  - PUT pricing.roundingRule = "weird" → 400.
  - Deep-merge: PUT inventory.lowStockThreshold doesn't drop
    a previously saved oversellPolicy.

- `frontend/src/pages/SettingsPage.test.tsx` (extend):
  - Inventory tab no longer placeholder; renders Stock-guards
    and Audit-&-snapshots headings.
  - Pricing tab no longer placeholder; renders Rounding and
    Defaults headings.
  - Saving safetyLock on the Inventory tab issues a top-level
    `{ safetyLock: ... }` PUT (not nested under inventory) since
    the existing webhook handler reads `settings.safetyLock`
    top-level. We don't migrate live data in this milestone.

---

## Acceptance criteria

- [x] Compiles, lints, vitest pass.
- [x] /settings#inventory and /settings#pricing both render real
  cards (no placeholder).
- [x] PUT round-trips every new field.
- [x] Existing `safetyLock` still works end-to-end (the webhook
  handler still reads it from `settings.safetyLock`).
- [x] Two tabs flipped to `"ready"`; remaining R1 placeholders
  point at M-164..M-167.

---

## Out of scope (deferred)

- Behaviour wiring for low-stock alerts (M-165 — Notifications).
- Behaviour wiring for B2B markup at checkout (separate post-R1
  task; needs the pricing engine to read `settings.pricing.b2bMarkupPercent`
  when a B2B customer hits checkout).
- Audit-log pruning daemon honoring `auditRetentionDays` (cron
  worker job, separate ticket).
- Snapshot frequency wiring (cron job, separate ticket).
- Currency formatter actually used in storefront blocks (theme
  block reads, separate task).

These are explicit "ship the option, wire the behaviour later"
calls per the established R-phase pattern.
