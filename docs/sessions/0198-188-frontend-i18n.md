# Session 0198 — M-188 · Frontend admin i18n

- **Date:** 2026-05-07
- **Milestone(s):** M-188
- **Branch:** claude/objective-sinoussi-77ae86

---

## Goal

Translate BundleForge's own admin UI copy when the merchant
picks a non-English locale. M-186 wired the dashboard's
language dropdown to swap Polaris's shipped strings (Save /
Cancel / dialog buttons) but every label *we wrote* —
"Dashboard", "Bundles", widget titles, checklist steps —
stayed hardcoded English. This milestone wires real i18n.

## What was done

- **Spec:** `docs/specs/M-188-frontend-i18n.md`.

### Infrastructure

- **Installed** `i18next ^26.0.10` + `react-i18next ^17.0.7`.
- **New** `frontend/src/lib/i18n/index.ts` — initialises
  i18next with all 15 supported locales statically imported.
  Initial language is read SYNCHRONOUSLY from `localStorage`
  (`bundleforge:polaris-locale`) so the first paint is in
  the merchant's chosen language — no fetch race with App
  Bridge's session-token handshake. English is the
  fallback; missing keys return the key string itself
  (`parseMissingKeyHandler`) so untranslated surfaces never
  show "undefined".
- **New** `frontend/src/lib/i18n/locales/{locale}.json` —
  15 files, one per locale.
  - `en.json` — full source of truth, ~80 keys grouped by
    namespace (`nav`, `settings`, `dashboard`, `checklist`,
    `bundles`, `support`, `status`, `actions`, `common`).
  - `es.json` / `fr.json` / `de.json` / `it.json` /
    `pt.json` — hand-translated.
  - `ja.json` / `zh.json` / `ko.json` / `nl.json` /
    `pl.json` / `sv.json` / `da.json` / `no.json` /
    `ru.json` — copies of `en.json` with a top-level
    `__needsTranslation: true` marker so future
    translation PRs can target them mechanically without
    touching app code.

### Component changes

Translations applied to the high-leverage surfaces listed in
the spec:

- **Top nav** (`App.tsx` `NAV_TABS`) — `content` field
  replaced with `i18nKey`; `InAppTabs` renders via
  `t(\`nav.\${id}\`)`.
- **App Bridge sidebar** (`NavMenu.tsx`) — every `<a>`
  child now wraps `t("nav.X")`.
- **Settings sidebar** (`SettingsSidebar.tsx`) — each tab
  renders `t(\`settings.\${id}\`)` with the prop-supplied
  `content` as a default value.
- **Dashboard widget shell** (`widgets.tsx` `WidgetCard`) —
  loading / error / empty messages translated.
- **All 7 widget titles** — `Revenue snapshot` /
  `Recent bundles` / `Bundle status` / `Inventory health` /
  `Recent orders` / `AI bundle suggestions` /
  `Recent activity`.
- **DashboardPage** (`DashboardPage.tsx`) — `<Page title>`,
  primary + secondary actions, `PageLoading` title.
- **Setup checklist** (`SetupChecklist.tsx` +
  `DashboardPage.tsx` step builder) — header title,
  progress count with `{{complete}}` / `{{total}}`
  interpolation, dismiss aria-label, all 3 step titles +
  bodies + primary CTAs + the "Mark complete" secondary
  button.
- **AppLanguageSelect** — "App language" label +
  saving spinner aria.

### Out of scope (deferred)

- **Settings tab card content** (~300+ helpText / label
  strings across General / Display / Inventory / Pricing /
  Cart / Notifications / Integrations / API / Localization /
  Billing). Stays English. Future PRs replace literals with
  `t()` calls mechanically.
- **Bundle Detail tab content** — same.
- **Help drawer markdown article bodies** — content task,
  not code.
- **Toast messages, error banners, server-rendered errors**
  — stay English.

### Test infra

- `tests/setup.frontend.ts` now imports the i18n init module
  so component tests using `useTranslation()` get real
  translations instead of falling back to key strings. Two
  M-186 tests + two M-184 tests had to be updated to expect
  real translations after this change.

## Tests

- **New** `frontend/src/lib/i18n/i18n.test.ts` — 6 cases:
  - EN default loads with expected keys.
  - Switch to FR translates known keys
    (`nav.dashboard` → "Tableau de bord", etc.).
  - Switch to DE translates known keys.
  - Stub-locale fallback (JA renders English values from the
    stub copy).
  - Missing-key fallback returns the key string.
  - Interpolation works across locales (
    `t("checklist.progress", { complete: 2, total: 3 })`
    renders correctly in EN and FR).
- 822/822 total vitest pass (+6).

## Tests + lint

- `npm run typecheck` — clean.
- `npx vite build` — succeeds; bundle grew ~105 KB raw /
  ~25 KB gzipped for i18next + 15 locale JSONs eagerly
  bundled. Acceptable for an admin-only frontend.
- `npx vitest run` — 822 passed, 13 skipped.
- `npm run lint` — 6 errors / 16 warnings (baseline,
  unchanged).

## Verified by hand

- N/A this session — visual verification on the dev store
  is the user's next step after deploy. The expectation:
  pick "Français" from the dashboard, the page reloads,
  and the top nav, settings sidebar, dashboard headings,
  setup checklist, and widget titles all render in French.
  Out-of-scope surfaces stay English (no regression — the
  English text is what the literals always rendered before
  M-188).

## Surprises and learnings

- **i18next's `parseMissingKeyHandler` returns the key
  string by default** when a translation is missing. That
  means out-of-scope surfaces calling `t("settings.tabCard.title")`
  without a translation will render `settings.tabCard.title`
  as visible text. We rely on this being acceptable for
  surfaces that haven't been migrated yet — currently we
  only call `t()` on surfaces with translations defined,
  so no leakage.
- **Tests using `useTranslation()` need i18n initialized
  before mount.** Adding the init import to
  `setup.frontend.ts` fixes this globally for the suite.
- **JSON `import` works seamlessly with Vite's Rollup**
  when the path is static. The locale loader's previous
  dynamic-import-with-template-literal bug (M-186 polish)
  doesn't apply here because we're statically importing 15
  known files.

## Deferred

- Mechanical translation pass for the deferred surfaces —
  one PR per surface (settings tab cards, bundle detail
  tabs, toast/error strings).
- Right-to-left layout for Arabic / Hebrew (Polaris
  supports it; our 15 locales are all LTR).
- Lazy-loading per-locale JSONs to shrink the initial
  bundle (worthwhile at 30+ locales; over-engineering at 15).
- Translation management platform integration
  (Lokalise / Crowdin) — JSON files in the repo are the
  source of truth for now.

## Handoff

Phase R5 milestones now: M-184, M-185, M-186, M-187, M-188
all done. No queued roadmap milestone. Open backlog items
in STATE.md unchanged.

When merchants want their admin in their language, the
infrastructure is now in place. The visible scope today is
~80 high-leverage strings; extending to the full app is a
mechanical sweep that future PRs can do incrementally
without re-touching the i18n plumbing.
