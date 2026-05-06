# Session 0161 — Settings shell + General tab (Phase R1 start)

- **Date:** 2026-05-06
- **Milestone(s):** M-161
- **Branch:** claude/objective-sinoussi-77ae86
- **Commit(s):** TBD (this session)

---

## Goal

First milestone of Phase R1 from
`docs/plans/rich-admin-ui-roadmap.md`. Replace the 107-line
two-toggle SettingsPage with a 10-tab shell that has slots for every
Phase R1 tab, with the General tab fully populated.

## What was done

- **Spec written** —
  `docs/specs/M-161-settings-shell-general.md`. Names the 10 tabs,
  the server schema namespacing under `settings.general`, the deep-
  merge contract for partial PATCHes, and the General tab cards.

- **Server** — Rewrote `src/routes/settings.ts`:
  - `PatchSchema` now strict; rejects unknown keys.
  - New `GeneralPatch` Zod with brandColor (hex), logoUrl (URL),
    currency (3-letter ISO), locale (2-5 chars), timezone.
  - GET response merges Shop columns (name/email/shopifyDomain/
    currency/locale/timezone) with `settings.general` overrides
    into a unified `general` subobject.
  - PUT deep-merges `general` so per-card Save buttons don't wipe
    sibling fields.
  - The Shop columns are never mutated by this endpoint —
    overrides land in the JSON blob only.

- **Frontend** — Rewrote `frontend/src/pages/SettingsPage.tsx` (now
  ~430 lines):
  - Polaris `Tabs` with 10 entries; each non-General tab renders a
    `PlaceholderTab` pointing at the milestone that ships its
    content (M-162..M-167).
  - Hash routing via `window.location.hash` and the `hashchange`
    event; deep-link to `/settings#display` works.
  - General tab cards:
    - **Shop** — read-only display of name, email, domain.
    - **Brand** — hex color TextField with live swatch preview;
      logo URL TextField with `<img>` preview; client-side hex
      validation; help text noting that direct file upload lands
      in M-167.
    - **Defaults** — currency / locale / timezone Selects (30
      currencies, 15 locales pulled from `SUPPORTED_LOCALES`,
      30 IANA zones).
  - Per-card Save buttons issue partial PATCHes; success Banner
    flashes and auto-dismisses after 2.4s.

- **Tests added:**
  - `src/routes/settings.test.ts` extended from 4 → 9 cases:
    GET subobject merge, override overlay, hex rejection,
    brandColor round-trip, deep-merge non-clobber, combined
    top-level + general patch.
  - `frontend/src/pages/SettingsPage.test.tsx` (new, 5 cases):
    10 tabs render, General cards render, brandColor PATCH fires
    with the expected body, malformed hex blocked client-side
    before PATCH, hash navigation selects the right placeholder.

- **Docs** — Added Phase R section to `docs/PLAN.md` with all 22
  milestones tracked (R1 spelled out per-row, R2-R4 in summary
  tables). STATE.md updated with new current-milestone, new
  recently-completed entry, and bumped test counts.

## Acceptance criteria status

- [x] Compiles (server + frontend tsc --noEmit clean).
- [x] Lint: 5 pre-existing errors only; no new violations.
- [x] All 481 vitest tests pass (was 471; +10 net new).
- [x] /settings renders the 10-tab shell.
- [x] General tab persists brandColor, logoUrl, currency, locale,
  timezone through partial PATCHes.
- [x] Hash navigation works (`/settings#display` opens Display tab).
- [x] Existing settings (`safetyLock`, `notifications`) still
  persist server-side; only their UI surface moved (they'll
  resurface in M-163 / M-165).

## Verified by hand

- `npx vitest run src/routes/settings.test.ts` → 9/9.
- `npx vitest run frontend/src/pages/SettingsPage.test.tsx` → 5/5.
- `npx vitest run` (full) → 481 passed, 13 skipped.
- `npm run typecheck` → clean.

## Deferred

- Direct logo file upload via Shopify Files stagedUploadsCreate —
  M-167 (alongside the API & webhooks tab).
- Inventory toggle re-surfacing — M-163.
- Notifications toggle re-surfacing — M-165.
- All other tabs — M-162..M-167 per the roadmap.

## Notes

The deep-merge logic on `general` is the part that took the most
care: a naive `{ ...prev, ...patch }` would cause the Brand-card
Save to wipe `currency` set from the Defaults card, which is a
real merchant footgun. Tests case 5 ("deep-merges general
subobject") locks the behavior in.

Polaris's `<Text as="h2">` renders a single `<h2>` so the test
selector uses `getByRole("heading", { name, level: 2 })` which
disambiguates from TextField labels that contain similar substrings
(e.g. "Brand color (hex)"). Also added an explicit
`cleanup()` in afterEach because vitest doesn't auto-call testing-
library's cleanup unless globals are configured for it.
