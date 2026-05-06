# M-161 — Settings shell + General tab

> First milestone of Phase R1 from
> `docs/plans/rich-admin-ui-roadmap.md`. Replaces the 107-line
> two-toggle SettingsPage with a tabbed shell that has slots for
> every Phase R1 tab, with the General tab fully populated.

---

## Why

The competitive audit (`docs/competitive-audit-2026-05-06.md`) shows
every meaningful competitor exposes a multi-tab settings surface
covering shop branding, inventory defaults, pricing defaults, cart
behavior, notifications, integrations, and API access. We have one
page with two checkboxes. That's the single most "basic"-looking
screen in the admin per the user's 2026-05-06 feedback.

This milestone lays the rails: a 10-tab shell with hash-routed
navigation, a server schema that namespaces settings under
`settings.<tab>` so future tabs can land without churning the
existing data, and one fully-built tab (General) so the pattern is
visible and the merchant can change something useful immediately.

---

## Scope

### Server

1. Extend `src/routes/settings.ts` `PatchSchema` to accept a `general`
   subobject:
   ```ts
   general: z.object({
     brandColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
     logoUrl: z.string().url().optional(),
     currency: z.string().length(3).optional(),
     locale: z.string().min(2).max(5).optional(),
     timezone: z.string().optional(),
   }).optional()
   ```
   Existing `safetyLock` and `notifications` continue to validate
   (don't break the deployed admin).

2. The GET response now returns a merged shape:
   ```jsonc
   {
     "general": {
       // overrides from settings.general...
       "brandColor": "#1f5fa6",
       "logoUrl": null,
       // shop-record fallbacks (read-only-ish — see below)
       "name": "Devstore",
       "email": "owner@devstore.com",
       "currency": "USD",
       "locale": "en",
       "timezone": "America/Los_Angeles"
     },
     "safetyLock": false,
     "notifications": { "email": true, "inApp": true }
   }
   ```
   Server-side merge: read `Shop` columns (`name`, `email`,
   `currency`, `locale`, `timezone`), then overlay
   `settings.general` overrides on top. Frontend shows what's in the
   merged shape; saving any of {currency, locale, timezone} writes
   to `settings.general.<key>`, never to the Shop column itself
   (Shop columns reflect what Shopify gave us at install).

3. PUT continues to merge top-level keys, but if `general` is in the
   patch, it deep-merges into `settings.general` rather than
   replacing the whole subobject.

### Client

1. Replace `frontend/src/pages/SettingsPage.tsx` with a tabbed shell:
   ```
   General | Display | Inventory | Pricing | Cart & Checkout |
   Notifications | Integrations | API & webhooks | Localization | Billing
   ```
   - Polaris `Tabs` component (already used in App.tsx).
   - Hash routing: `/settings`, `/settings#display`, etc. — clicking
     a tab updates the hash; loading with a hash selects that tab.
   - Each non-General tab is a placeholder Card with a one-line
     "Coming in M-NNN" pointing at the right milestone in the
     roadmap.

2. General tab content:
   - **Shop card** (read-only): name, email, Shopify domain.
     Caption: "These come from Shopify and update automatically."
   - **Brand card** (editable):
     - `brandColor` — Polaris `TextField` accepting a hex; live
       swatch preview to the right.
     - `logoUrl` — `TextField` accepting a URL; small preview
       `<img>` if non-empty (or "Upload logo" link disabled with
       "(connects in M-167)" note — keeps the surface visible
       without overpromising).
   - **Defaults card** (editable):
     - `currency` — `Select` with the most common 30 ISO codes.
     - `locale` — `Select` of the 15 supported locales (mirror
       `SUPPORTED_LOCALES` from `src/i18n/index.ts`).
     - `timezone` — `Select` (top 30 IANA zones for now; full
       picker in a later milestone if needed).
   - Save button at the bottom of each card; saves only that card's
     values via PATCH.
   - Toast/banner on success and on error.

3. Existing `safetyLock` and `notifications` toggles move to the
   Inventory tab and the Notifications tab respectively, but those
   tabs render only a placeholder Card in M-161 — so the toggles
   are temporarily hidden from the UI but **still persist server-
   side** and continue to be respected by existing code paths
   (M-163 surfaces them again with the rest of the inventory tab,
   M-165 with the rest of the notifications tab). This is the
   smallest amount of churn that keeps the tab structure honest.

### Tests

- `frontend/src/pages/SettingsPage.test.tsx` (new):
  1. Renders all 10 tab labels.
  2. Hash `/settings#display` selects the Display tab on mount.
  3. Editing brandColor and clicking Save calls PATCH with
     `{ general: { brandColor: "#abcdef" } }` and the value
     persists across reload (mocked).
  4. PATCH error surfaces as a critical Banner.

- `src/routes/settings.test.ts` (extend if exists, else add):
  1. PUT with `{ general: { brandColor: "#1f5fa6" } }` round-trips.
  2. PUT with malformed brandColor (non-hex) returns 400.
  3. GET merges Shop columns + settings.general into the `general`
     subobject.
  4. PUT with both top-level `safetyLock` AND `general.brandColor`
     persists both without loss.

---

## Acceptance criteria

- [x] `npm run typecheck` clean (server + frontend).
- [x] `npm run lint` no new errors (5 pre-existing OK).
- [x] All 471+ vitest tests pass.
- [x] /settings renders 10-tab shell.
- [x] General tab can change brand color, logo URL, default
  currency/locale/timezone, and round-trips through the API.
- [x] Hash navigation works (deep-link to a tab, back/forward).
- [x] Existing settings (safetyLock, notifications) still persist
  and the underlying behavior is unchanged — only the UI surface
  moved.

---

## Out of scope (deferred)

- Real logo upload via Shopify Files API stagedUploadsCreate (M-161
  ships URL-only; full upload lands in either M-167 alongside the
  API tab or as a small follow-on M-161b).
- Inventory tab content (M-163).
- Notifications tab content (M-165).
- All other tabs (M-162..M-167).
