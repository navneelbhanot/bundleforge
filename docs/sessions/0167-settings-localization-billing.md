# Session 0167 — Settings · Localization + Billing + GM feed URL

- **Date:** 2026-05-06
- **Milestone(s):** M-167 (re-scoped — see Notes)
- **Branch:** claude/objective-sinoussi-77ae86
- **Commit(s):** TBD

---

## Goal

Build out the Localization tab and the Billing tab in the
SettingsPage shell, plus surface the Google Merchant feed URL on
the Integrations tab (deferred from M-166).

## What was done

- **Spec written, then re-scoped mid-spec** —
  `docs/specs/M-167-settings-api-localization-billing.md`. The
  initial draft folded the API & webhooks tab in, but two new
  Prisma models + migrations + two CRUD routes is its own
  milestone per CLAUDE.md §4. M-167 narrowed to Localization +
  Billing + the GM feed URL; API & webhooks split into M-168.

- **Server** (`src/routes/settings.ts`):
  - New `LocalizationPatch` Zod (strict): `enabledLocales`
    (array of 15 supported locales), `fallbackLocale`,
    `machineTranslateMissing` boolean. `LocaleEnum` derives from
    `SUPPORTED_LOCALES` exported from `src/i18n/index.ts`.
  - GET response gains `localization` raw subobject. PUT uses
    the existing `mergeSubobject` helper.

- **Frontend** (`frontend/src/pages/SettingsPage.tsx`):
  - New `LocalizationBlock` type + `LOCALIZATION_DEFAULTS`.
  - `LocalizationCard` with `ChoiceList allowMultiple` for the
    15 locales, `Select` for fallback locale, `Checkbox` for
    machine-translate-missing, soft warning if the chosen
    fallback is not in the enabled list.
  - Wired in via the existing tab switch.
  - `patchLocalization` shorthand routed through
    `patchSubobject` (key-union widened).
  - Localization + Billing TabSpecs flipped to `"ready"`. API tab
    placeholder updated to point at M-168.

- **BillingPage extraction**
  (`frontend/src/components/BillingPanel.tsx`, new file):
  - Extracted the inner Layout block from `BillingPage.tsx` into
    a shared component with both controlled (data-prop) and
    uncontrolled (self-fetching) modes.
  - `BillingPage.tsx` is now a thin Page wrapper around
    `BillingPanel`.
  - Settings tab renders `BillingPanel` directly inside the
    settings shell.

- **IntegrationsTab feed URL surface**
  (`frontend/src/components/IntegrationsTab.tsx`):
  - New `feedUrlFor(type, shopifyDomain)` helper builds
    `<origin>/api/feeds/google-merchant?shop=<domain>`.
  - New `FeedUrlSurface` component: read-only TextField + Copy
    button (uses `navigator.clipboard.writeText` with a textarea
    fallback for jsdom).
  - The `google_merchant` row now renders the surface when a
    `shopifyDomain` prop is passed; otherwise shows a hint.
  - SettingsPage passes `state.general.shopifyDomain` through.

## Tests added

- `src/routes/settings.test.ts` (32 cases, +3):
  - Round-trips a localization patch.
  - Rejects unsupported locale in `localization.fallbackLocale`.
  - Deep-merge: fallbackLocale save doesn't drop enabledLocales.

- `frontend/src/pages/SettingsPage.test.tsx` (20 cases, +3):
  - Localization tab renders the Localization heading.
  - Localization PATCH sends the localization subobject (e.g.
    machineTranslateMissing toggle).
  - Billing tab renders the BillingPanel inside the settings
    shell (mocks /api/v1/billing + /api/v1/billing/plans).
  - Updated placeholder regression to point at M-168 (since
    Localization + Billing now resolve, only the API tab
    placeholder remains).

- `frontend/src/components/IntegrationsTab.test.tsx` (5 cases, +1):
  - Replaced the "Feed URL surfaces in M-167" assertion with two
    cases: when `shopifyDomain` is provided the feed URL
    TextField + Copy button render, when it's null a fallback
    "needs your Shopify domain" hint shows.

## Acceptance criteria status

- [x] Compiles, lints clean, 538/538 vitest pass.
- [x] /settings#localization renders the Localization card.
- [x] /settings#billing renders the BillingPanel inside the
  settings shell.
- [x] Google Merchant card shows the feed URL with a Copy button.
- [x] Plain `/billing` route still works (uses BillingPanel).
- [x] Localization + Billing TabSpecs flipped to `"ready"`.
- [ ] Phase R1 closure deferred to M-168 (intentional re-split).

## Verified by hand

- `npx vitest run src/routes/settings.test.ts` → 32/32.
- `npx vitest run frontend/src/pages/SettingsPage.test.tsx` → 20/20.
- `npx vitest run frontend/src/components/IntegrationsTab.test.tsx`
  → 5/5.
- `npx vitest run` (full) → 538 passed, 13 skipped.
- `npm run typecheck` → clean.

## Deferred (per spec re-scope)

- **M-168** — API & webhooks tab. Two new Prisma models
  (ApiToken, OutboundWebhook), two new CRUD routes
  (/api/v1/api-tokens, /api/v1/outbound-webhooks), token hashing
  via bcrypt/scrypt, frontend tables + Add modals. Closes
  Phase R1.
- Worker job that emits outbound webhooks (M-168 ships the
  configuration surface; the emission worker is its own ticket).
- Machine translation actually wired to a translation service
  (the toggle persists today; lookup chain reads it; provider
  integration is its own ticket).

## Notes

The decision to split this milestone was a real CLAUDE.md §4 call:
the original draft was 5,000+ lines of work (two Prisma models +
migrations + two new routes + token hashing + table+modal UI for
each) which doesn't fit "one session, ~200–800 LOC." Catching it
mid-spec rather than mid-implementation is the right move per
§3.2. PLAN.md updated to add M-168 row; STATE.md says next
session is M-168.

The shared `BillingPanel` extraction is the cleanest pattern when
the same surface needs to live in two places (a standalone Page
and a Settings tab). The component supports both controlled
(parent-fed `data` prop) and uncontrolled (self-fetching) modes,
so the Settings tab can stay simple while the standalone /billing
route doesn't change behaviour.

Copy-to-clipboard on the feed URL uses the modern
`navigator.clipboard.writeText` API with a graceful textarea
fallback for jsdom (which doesn't implement clipboard). The test
just asserts the button + URL render — actual clipboard
integration is environment-dependent.
